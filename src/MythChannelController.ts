import { ChannelController } from '@vestibule-link/alexa-video-skill-types';
import { CapabilityEmitter, DirectiveHandlers, StateEmitter, SupportedDirectives } from '@vestibule-link/bridge-assistant-alexa';
import { EndpointState, ErrorHolder, SubType } from '@vestibule-link/iot-types';
import * as Fuse from 'fuse.js';
import { backend, ChannelInfo } from 'mythtv-services-api';
import { MythAlexaEventFrontend } from "./Frontend";

type DirectiveType = ChannelController.NamespaceType;
const DirectiveName: DirectiveType = ChannelController.namespace;
type Response = {
    payload: {}
    state?: { [DirectiveName]?: SubType<EndpointState, DirectiveType> }
}

export default class FrontendChannel
    implements SubType<DirectiveHandlers, DirectiveType>, StateEmitter, CapabilityEmitter {
    readonly supported: SupportedDirectives<DirectiveType> = ['ChangeChannel', 'SkipChannels'];
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaEmitter.on('refreshState', this.refreshState.bind(this));
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.alexaEmitter.registerDirectiveHandler(DirectiveName, this);
        fe.mythEventEmitter.on('PLAY_CHANGED', message => {
            this.refreshState(this.fe.eventDeltaId())
        });
        fe.mythEventEmitter.on('LIVETV_STARTED', message => {
            this.refreshState(this.fe.eventDeltaId())
        });
        fe.mythEventEmitter.on('LIVETV_ENDED', message => {
            this.updateStoppedState(this.fe.eventDeltaId())
        });
        fe.mythEventEmitter.on('PLAY_STOPPED', message => {
            this.updateStoppedState(this.fe.eventDeltaId())
        });
    }

    refreshState(deltaId: symbol): void {
        const promise = this.updateWatchedState(deltaId);
        this.fe.alexaEmitter.watchDeltaUpdate(promise, deltaId);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaEmitter.emit('capability', DirectiveName, ['channel'], deltaId);
    }

    async ChangeChannel(payload: ChannelController.ChangeChannelRequest): Promise<Response> {
        const channel = payload.channel;
        const channelMetadata = payload.channelMetadata;
        const currentChannel = await this.state();
        let chanNum = channel.number;
        if (!chanNum) {
            if (channelMetadata.name) {
                chanNum = ChannelLookup.instance.searchChannel(channelMetadata.name);
            } else if (channel.affiliateCallSign) {
                chanNum = ChannelLookup.instance.searchChannel(channel.affiliateCallSign);
            } else if (channel.callSign) {
                chanNum = ChannelLookup.instance.searchChannel(channel.callSign);
            }
        }

        if (chanNum) {
            await this.sendChannelChange(chanNum, currentChannel != undefined);
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
        return {
            payload: {}
        }
    }
    async SkipChannels(payload: ChannelController.SkipChannelsRequest): Promise<Response> {
        const channelCount = payload.channelCount
        const currentChannel = await this.state();
        if (currentChannel) {
            const nextChannel = ChannelLookup.instance.getSkipChannelNum(currentChannel.number, channelCount);
            if (nextChannel) {
                await this.sendChannelChange(nextChannel, true);
            } else {
                console.log('Unable to find Current Channel %o Channel Count %n', channelCount, currentChannel);
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
        return {
            payload: {}
        }
    }

    async sendChannelChange(chanNum: string, watchingTv: boolean): Promise<void> {
        if (!watchingTv) {
            await this.fe.SendAction({
                Action: 'Live TV'
            });
        }
        for (const chanPart of chanNum) {
            await this.fe.SendAction({
                Action: chanPart
            });
        }
        await this.fe.SendAction({
            Action: 'SELECT'
        });
    }
    async state(): Promise<ChannelController.Channel> {
        if (await this.fe.isWatchingTv()) {
            const status = await this.fe.GetStatus();
            const chanId = status.State.chanid;
            if (chanId) {
                const channelInfo = await backend.channelService.GetChannelInfo(chanId);
                if (channelInfo) {
                    const ret: ChannelController.Channel = {
                        number: channelInfo.ChanNum,
                        affiliateCallSign: channelInfo.CallSign
                    }
                    return ret;
                }
            }
        }
        return null;
    }

    private async updateWatchedState(deltaId: symbol): Promise<void> {
        this.fe.alexaEmitter.emit('state', DirectiveName, 'channel', await this.state(), deltaId);
    }
    private updateStoppedState(deltaId: symbol) {
        this.fe.alexaEmitter.emit('state', DirectiveName, 'channel', null, deltaId);
    }
}
class FuseOpt implements Fuse.FuseOptions<ChannelInfo> {
    readonly id = 'ChanNum'
    readonly caseSensitive = false
    readonly keys: { name: keyof ChannelInfo; weight: number }[] = [
        {
            name: 'ChannelName',
            weight: 0.5
        }, {
            name: 'CallSign',
            weight: 0.3
        }, {
            name: 'ChanNum',
            weight: 0.2
        }]
    readonly shouldSort = true;
    readonly tokenize = true;
}
class ChannelLookup {
    readonly chanNumToIndex = new Map<string, number>();
    private channelInfos: ChannelInfo[] | undefined;
    private fuse: Fuse<ChannelInfo, FuseOpt> | undefined;
    private fuseOptions = new FuseOpt();
    private hdSuffixes = ['', 'HD', 'DT'];
    private static _instance
    private constructor() {
        this.refreshChannelMap();
    }
    static get instance() {
        if (!this._instance) {
            this._instance = new ChannelLookup();
        }
        return this._instance;
    }
    private async  refreshChannelMap(): Promise<void> {
        const videoSources = await backend.channelService.GetVideoSourceList();
        const channelInfoPromises = videoSources.VideoSources.map(async videoSource => {
            return await backend.channelService.GetChannelInfoList({
                SourceID: videoSource.Id,
                OnlyVisible: true,
                Details: true
            });
        })
        const channelInfoLists = await Promise.all(channelInfoPromises)
        this.channelInfos = channelInfoLists.map(channelInfoList => {
            return channelInfoList.ChannelInfos;
        }).reduce((prev, current) => {
            return prev.concat(current);
        }).filter(channelInfo => {
            return channelInfo.Visible;
        }).sort((a, b) => {
            const majorSort = a.ATSCMajorChan - b.ATSCMajorChan;
            if (majorSort == 0) {
                return a.ATSCMinorChan - b.ATSCMinorChan;
            }
            return majorSort;
        })
        this.fuse = new Fuse(this.channelInfos, this.fuseOptions);
        this.chanNumToIndex.clear();
        this.channelInfos.forEach((channelInfo, index) => {
            this.chanNumToIndex.set(channelInfo.ChanNum, index);
        })
    }

    getSkipChannelNum(chanNum: string, channelCount: number): string | undefined {
        const currentIndex = this.chanNumToIndex.get(chanNum);
        if (currentIndex) {
            let nextIndex = currentIndex + channelCount;
            if (nextIndex > this.channelInfos.length) {
                nextIndex -= this.channelInfos.length;
            } else if (nextIndex < 0) {
                nextIndex = this.channelInfos.length + nextIndex;
            }
            return this.channelInfos[nextIndex].ChanNum;
        }
    }

    isValidChanNum(chanNum: string): boolean {
        return this.chanNumToIndex.get(chanNum) != undefined;
    }
    searchChannel(metadata: string): string | undefined {
        if (!this.isValidChanNum(metadata)) {
            metadata += this.hdSuffixes.join(' ');
        }
        const ret = this.fuse.search(metadata, {
            limit: 1
        })
        if (ret.length == 1) {
            return ret[0];
        }
    }
}