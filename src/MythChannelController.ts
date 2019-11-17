import { ChannelController, PlaybackStateReporter } from '@vestibule-link/alexa-video-skill-types';
import { CapabilityEmitter, DirectiveHandlers, StateEmitter, SupportedDirectives } from '@vestibule-link/bridge-assistant-alexa';
import { EndpointState, ErrorHolder, SubType } from '@vestibule-link/iot-types';
import * as Fuse from 'fuse.js';
import { masterBackend, ApiTypes } from 'mythtv-services-api';
import { MythAlexaEventFrontend } from "./Frontend";
import { keyBy, Dictionary } from 'lodash'
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
    implements SubType<DirectiveHandlers, DirectiveType>, StateEmitter, CapabilityEmitter {
    readonly supported: SupportedDirectives<DirectiveType> = ['ChangeChannel', 'SkipChannels'];
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaEmitter.on('refreshState', this.refreshState.bind(this));
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.alexaEmitter.registerDirectiveHandler(DirectiveName, this);
        fe.mythEventEmitter.on('PLAY_CHANGED', message => {
            if (this.fe.isWatchingTv() && message.CHANID) {
                const promise = this.updateStateFromChanId(Number(message.CHANID))
                this.fe.alexaEmitter.watchDeltaUpdate(promise, this.fe.eventDeltaId());
            }
        });
        fe.mythEventEmitter.on('LIVETV_ENDED', message => {
            this.updateStoppedState(this.fe.eventDeltaId())
        });
        fe.masterBackendEmitter.on('PLAY_STOPPED',message=>{
            this.updateStoppedState(this.fe.eventDeltaId())
        })
    }

    refreshState(deltaId: symbol): void {
        const promise = this.updateStateAndChannel(deltaId);
        this.fe.alexaEmitter.watchDeltaUpdate(promise, deltaId);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaEmitter.emit('capability', DirectiveName, ['channel'], deltaId);
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
                chanNum = channelLookup.searchCallSign(channel.affiliateCallSign);
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
            const currentChannel = this.fe.alexaEmitter.endpoint[ChannelController.namespace].channel
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
                value: 'PLAYING'
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
    private toChannel(channelInfo: ApiTypes.ChannelInfo | undefined): ChannelController.Channel {
        if (channelInfo) {
            return {
                number: channelInfo.ChanNum,
                affiliateCallSign: channelInfo.CallSign
            }
        } else {
            return null
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
        this.fe.alexaEmitter.emit('state', DirectiveName, 'channel', state, deltaId);
    }
    private updateStoppedState(deltaId: symbol) {
        this.fe.alexaEmitter.emit('state', DirectiveName, 'channel', null, deltaId);
    }
}
class FuseOpt implements Fuse.FuseOptions<ApiTypes.ChannelInfo> {
    readonly includeScore = true
    readonly caseSensitive = false
    readonly keys: { name: keyof ApiTypes.ChannelInfo; weight: number }[];
    readonly shouldSort = true;
    readonly minMatchCharLength = 3;
    constructor(name: keyof ApiTypes.ChannelInfo, readonly tokenize: boolean) {
        this.keys = [
            {
                name: name,
                weight: 0.01
            }
        ]
    }
}
class ChannelLookup {
    private readonly chanNumToIndex = new Map<string, number>();
    private readonly callSignToChanNum = new Map<string, string>();
    private channelInfos: ApiTypes.ChannelInfo[] | undefined;
    private channelNameFuse: Fuse<ApiTypes.ChannelInfo, FuseOpt> | undefined;
    private channelInfoByChanId: Dictionary<ApiTypes.ChannelInfo>
    private hdSuffixes = ['HD', 'DT', ''];
    private static _instance
    private constructor() {
    }
    static async instance(): Promise<ChannelLookup> {
        if (!this._instance) {
            this._instance = new ChannelLookup();
            await this._instance.refreshChannelMap();
        }
        return this._instance;
    }
    private async refreshChannelMap(): Promise<void> {
        const channelOrder = await masterBackend.mythService.GetSetting({
            Key: 'ChannelOrdering',
            Default: 'channum'
        })
        const channelInfoList = await masterBackend.channelService.GetChannelInfoList({
            OnlyVisible: true,
            Details: true,
            OrderByName: channelOrder != 'channum'
        })
        this.channelInfos = channelInfoList.ChannelInfos
        this.channelNameFuse = new Fuse(this.channelInfos, new FuseOpt('ChannelName', true));
        this.chanNumToIndex.clear();
        this.channelInfos.forEach((channelInfo, index) => {
            this.chanNumToIndex.set(channelInfo.ChanNum, index);
        })
        this.callSignToChanNum.clear();
        this.channelInfos.forEach((channelInfo) => {
            this.callSignToChanNum.set(channelInfo.CallSign, channelInfo.ChanNum);
        })
        this.channelInfoByChanId = keyBy(this.channelInfos, 'ChanId')
    }

    getSkipChannelNum(chanNum: string, channelCount: number): string | undefined {
        const currentIndex = this.chanNumToIndex.get(chanNum);
        if (currentIndex != undefined) {
            let nextIndex = currentIndex + channelCount;
            if (nextIndex >= this.channelInfos.length) {
                nextIndex -= this.channelInfos.length;
            } else if (nextIndex < 0) {
                nextIndex = this.channelInfos.length + nextIndex;
            }
            if (nextIndex < 0 || nextIndex >= this.channelInfos.length) {
                return this.getSkipChannelNum(this.channelInfos[0].ChanNum, nextIndex)
            } else {
                return this.channelInfos[nextIndex].ChanNum;
            }
        }
    }

    isValidChanNum(chanNum: string): boolean {
        return this.chanNumToIndex.get(chanNum) != undefined;
    }
    searchChannelName(chanName: string): string | undefined {
        for (let index = 0; index < this.hdSuffixes.length; index++) {
            const hdSuffix = this.hdSuffixes[index];
            const chanNum = this.searchChannel(this.channelNameFuse, chanName + ' ' + hdSuffix)
            if (chanNum) {
                return chanNum;
            }
        }
    }
    searchCallSign(callSign: string): string | undefined {
        for (let index = 0; index < this.hdSuffixes.length; index++) {
            const hdSuffix = this.hdSuffixes[index];
            const chanNum = this.callSignToChanNum.get(callSign + hdSuffix)
            if (chanNum) {
                return chanNum;
            }
        }
    }
    private searchChannel(fuse: Fuse<ApiTypes.ChannelInfo, FuseOpt>, search: string): string | undefined {
        const ret = fuse.search(search, {
            limit: 1
        })
        if (ret.length == 1) {
            return ret[0].item.ChanNum;
        }
    }

    public getChannelInfoForChanId(chanId: number) {
        return this.channelInfoByChanId[chanId]
    }
}