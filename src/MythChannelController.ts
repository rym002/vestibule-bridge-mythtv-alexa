import { ChannelController } from '@vestibule-link/alexa-video-skill-types';
import { CapabilityEmitter, DirectiveHandlers, StateEmitter, SupportedDirectives } from '@vestibule-link/bridge-assistant-alexa';
import { EndpointState, ErrorHolder, SubType } from '@vestibule-link/iot-types';
import * as Fuse from 'fuse.js';
import { masterBackend, ApiTypes } from 'mythtv-services-api';
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
        const channelLookup = await ChannelLookup.instance();
        if (!chanNum) {
            if (channelMetadata && channelMetadata.name) {
                chanNum = channelLookup.searchChannelName(channelMetadata.name);
            } else if (channel.affiliateCallSign) {
                chanNum = channelLookup.searchCallSign(channel.affiliateCallSign);
            } else if (channel.callSign) {
                chanNum = channelLookup.searchCallSign(channel.callSign);
            }
        } else {
            if (!channelLookup.isValidChanNum(chanNum)) {
                chanNum = undefined;
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
            const channelLookup = await ChannelLookup.instance();
            const nextChannel = channelLookup.getSkipChannelNum(currentChannel.number, channelCount);
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
                const channelInfo = await masterBackend.channelService.GetChannelInfo({ChanID:chanId});
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
        const videoSources = await masterBackend.channelService.GetVideoSourceList();
        const channelInfoPromises = videoSources.VideoSources.map(async videoSource => {
            return await masterBackend.channelService.GetChannelInfoList({
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
        }).sort((a, b) => {
            const majorSort = a.ATSCMajorChan - b.ATSCMajorChan;
            if (majorSort == 0) {
                return a.ATSCMinorChan - b.ATSCMinorChan;
            }
            return majorSort;
        })

        this.channelNameFuse = new Fuse(this.channelInfos, new FuseOpt('ChannelName', true));
        this.chanNumToIndex.clear();
        this.channelInfos.forEach((channelInfo, index) => {
            this.chanNumToIndex.set(channelInfo.ChanNum, index);
        })
        this.callSignToChanNum.clear();
        this.channelInfos.forEach((channelInfo) => {
            this.callSignToChanNum.set(channelInfo.CallSign, channelInfo.ChanNum);
        })
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
}