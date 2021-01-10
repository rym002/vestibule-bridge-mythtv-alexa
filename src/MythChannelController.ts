import { ChannelController, PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import { CapabilityEmitter, DirectiveHandlers, StateEmitter, SupportedDirectives } from '@vestibule-link/bridge-assistant-alexa';
import { EndpointState, ErrorHolder, SubType } from '@vestibule-link/iot-types';
import { MythAlexaEventFrontend, RegisteringDirective } from "./Frontend";
import { ChannelLookup } from '@vestibule-link/bridge-mythtv';
import { AffiliateChannelInfo } from '@vestibule-link/bridge-mythtv/dist/channel';
type DirectiveType = ChannelController.NamespaceType;
const DirectiveName: DirectiveType = ChannelController.namespace;
type Response = {
    payload: {}
    state?: {
        [DirectiveName]?: SubType<EndpointState, DirectiveType>
        [PlaybackStateReporter.namespace]?: SubType<EndpointState, PlaybackStateReporter.NamespaceType>
    }
}

export default class FrontendChannel
    implements SubType<DirectiveHandlers, DirectiveType>, StateEmitter, CapabilityEmitter, RegisteringDirective {
    readonly supported: SupportedDirectives<DirectiveType> = ['ChangeChannel', 'SkipChannels'];
    readonly emptyChannel: ChannelController.Channel = {
        affiliateCallSign: null,
        callSign: null,
        number: null
    }
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.mythEventEmitter.on('PLAY_CHANGED', message => {
            if (this.fe.isWatchingTv() && message.CHANID) {
                const promise = this.updateStateFromChanId(Number(message.CHANID))
                this.fe.alexaConnector.watchDeltaUpdate(promise, this.fe.eventDeltaId());
            }
        });
        fe.mythEventEmitter.on('LIVETV_ENDED', message => {
            this.updateStoppedState(this.fe.eventDeltaId())
        });
        fe.mythEventEmitter.on('PLAY_STOPPED', message => {
            this.updateStoppedState(this.fe.eventDeltaId())
        })
    }

    async register(): Promise<void> {
        this.fe.alexaConnector.registerDirectiveHandler(DirectiveName, this);
    }
    refreshState(deltaId: symbol): void {
        const promise = this.updateStateAndChannel(deltaId);
        this.fe.alexaConnector.watchDeltaUpdate(promise, deltaId);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaConnector.updateCapability(DirectiveName, ['channel'], deltaId);
    }

    async ChangeChannel(payload: ChannelController.ChangeChannelRequest): Promise<Response> {
        const channel = payload.channel;
        const channelMetadata = payload.channelMetadata;
        let chanNum = channel.number;
        const channelLookup = await ChannelLookup.instance();
        if (!chanNum) {
            if (channel.callSign) {
                chanNum = channelLookup.searchCallSign(channel.callSign);
            } else if (channel.affiliateCallSign) {
                chanNum = channelLookup.searchAffiliate(channel.affiliateCallSign);
            }
        } else {
            if (!channelLookup.isValidChanNum(chanNum)) {
                chanNum = undefined;
            }
        }

        if (!chanNum) {
            if (channelMetadata && channelMetadata.name) {
                chanNum = channelLookup.searchChannelName(channelMetadata.name);
            }
        }

        if (chanNum) {
            return this.sendChannelChange(chanNum);
        } else {
            const err: ErrorHolder = {
                errorType: 'Alexa.Video',
                errorPayload: {
                    message: 'Invalid Channel',
                    type: 'NOT_SUBSCRIBED'
                }
            };
            throw err;
        }
    }
    async SkipChannels(payload: ChannelController.SkipChannelsRequest): Promise<Response> {
        const channelCount = payload.channelCount
        if (this.fe.isWatchingTv()) {
            const currentChannel = this.fe.alexaConnector.reportedState[ChannelController.namespace].channel
            const channelLookup = await ChannelLookup.instance();
            const nextChannel = channelLookup.getSkipChannelNum(currentChannel.number, channelCount);
            if (nextChannel) {
                return this.sendChannelChange(nextChannel);
            } else {
                console.log('Unable to find Current Channel %o Channel Count %n', currentChannel, channelCount);
                const err: ErrorHolder = {
                    errorType: 'Alexa',
                    errorPayload: {
                        message: 'Unable to find Current Channel',
                        type: 'NOT_SUPPORTED_IN_CURRENT_MODE'
                    }
                };
                throw err;
            }
        } else {
            const err: ErrorHolder = {
                errorType: 'Alexa',
                errorPayload: {
                    message: 'Not Watching TV',
                    type: 'NOT_SUPPORTED_IN_CURRENT_MODE'
                }
            };
            throw err;
        }
    }

    async sendChannelChange(chanNum: string): Promise<Response> {
        let playbackState = {}
        if (!this.fe.isWatchingTv()) {
            const channelPromise = this.fe.monitorStateChange(ChannelController.namespace)
            const playingMonitor = this.fe.monitorStateChange(PlaybackStateReporter.namespace, {
                name: 'playbackState',
                value: {
                    state: 'PLAYING'
                }
            })
            await this.fe.SendAction({
                Action: 'Live TV'
            });
            const channelState = await channelPromise
            playbackState = await playingMonitor || {}
            if (channelState[ChannelController.namespace]
                && channelState[ChannelController.namespace].channel
                && channelState[ChannelController.namespace].channel.number == chanNum) {
                return {
                    payload: {},
                    state: { ...playbackState, ...channelState }
                }
            }
        }
        const channelMonitor = await this.changeChannel(chanNum)
        return {
            payload: {},
            state: { ...playbackState, ...channelMonitor }
        }
    }
    private async changeChannel(chanNum: string): Promise<EndpointState | undefined> {
        for (const chanPart of chanNum) {
            await this.fe.SendAction({
                Action: chanPart
            });
        }
        const channelPromise = this.fe.monitorStateChange(ChannelController.namespace)
        await this.fe.SendAction({
            Action: 'SELECT'
        });
        return channelPromise;
    }
    private async state(): Promise<ChannelController.Channel> {
        if (this.fe.isWatchingTv()) {
            const status = await this.fe.GetStatus();
            const chanId = status.State.chanid;
            if (chanId) {
                const channelLookup = await ChannelLookup.instance()
                const channelInfo = channelLookup.getChannelInfoForChanId(chanId);
                return this.toChannel(channelInfo)
            }
        }
        return this.toChannel(undefined)
    }
    private toChannel(channelInfo?: AffiliateChannelInfo): ChannelController.Channel {
        if (channelInfo) {
            return {
                number: channelInfo.ChanNum,
                callSign: channelInfo.CallSign,
                affiliateCallSign: channelInfo.affiliateName != undefined ? channelInfo.affiliateName : null
            }
        } else {
            return this.emptyChannel
        }
    }

    private async updateStateAndChannel(deltaId: symbol) {
        const state = await this.state()
        return this.updateWatchedState(deltaId, state)
    }
    private async updateStateFromChanId(chanId: number) {
        const channelLookup = await ChannelLookup.instance()
        const channelInfo = channelLookup.getChannelInfoForChanId(chanId);
        const state = this.toChannel(channelInfo)
        this.updateWatchedState(this.fe.eventDeltaId(), state)
    }
    private updateWatchedState(deltaId: symbol, state: ChannelController.Channel) {
        this.fe.alexaConnector.updateState(DirectiveName, 'channel', state, deltaId);
    }
    private updateStoppedState(deltaId: symbol) {
        this.fe.alexaConnector.updateState(DirectiveName, 'channel', this.emptyChannel, deltaId);
    }
}
