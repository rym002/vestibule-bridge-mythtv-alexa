import { RemoteVideoPlayer, Video, PlaybackStateReporter } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, DirectiveHandlers, SupportedDirectives } from "@vestibule-link/bridge-assistant-alexa";
import { EndpointState, SubType } from "@vestibule-link/iot-types";
import { sortBy } from 'lodash';
import { ApiTypes, masterBackend } from "mythtv-services-api";
import { MythAlexaEventFrontend, RegisteringDirective, STATE_EVENT_TIMEOUT } from "./Frontend";


type DirectiveType = RemoteVideoPlayer.NamespaceType;
const DirectiveName: DirectiveType = RemoteVideoPlayer.namespace;
type Response = {
    payload: {}
    state?: { [PlaybackStateReporter.namespace]?: SubType<EndpointState, PlaybackStateReporter.NamespaceType> }
}
export default class FrontendVideoPlayer
    implements SubType<DirectiveHandlers, DirectiveType>, CapabilityEmitter, RegisteringDirective {
    readonly backend = masterBackend;
    readonly supported: SupportedDirectives<DirectiveType> = ['SearchAndPlay'];
    constructor(readonly fe: MythAlexaEventFrontend) {
    }

    async register(): Promise<void> {
        this.fe.alexaConnector.registerDirectiveHandler(DirectiveName, this);
    }
    refreshCapability(deltaId: symbol): void {
        this.fe.alexaConnector.updateCapability(DirectiveName, true, deltaId);
    }

    private async findRecordedId(searchCriteria: VideoSearchCriteria): Promise<number | undefined> {
        const searchTitles = searchCriteria.Video ? searchCriteria.Video.join('|') : undefined;
        const foundPrograms = await this.backend.dvrService.GetRecordedList({
            TitleRegEx: searchTitles
        });
        const programs = foundPrograms.Programs;
        const filteredPrograms = sortBy(programs, [
            (program: ApiTypes.Program) => Number(program.Season),
            (program: ApiTypes.Program) => Number(program.Episode),
            (program: ApiTypes.Program) => program.Airdate
        ]).filter(program => (
            (searchCriteria.Season == undefined || searchCriteria.Season.includes(program.Season + ''))
            &&
            (searchCriteria.Episode == undefined || searchCriteria.Episode.includes(program.Episode + ''))

        ))
        if (filteredPrograms.length > 0) {
            return filteredPrograms[0].Recording.RecordedId
        }
    }

    private async findVideoId(searchCriteria: VideoSearchCriteria): Promise<number | undefined> {
        const videoMetadataInfoList = await this.backend.videoService.GetVideoList({});
        const videoInfos = videoMetadataInfoList.VideoMetadataInfos
        const filteredVideos = videoInfos.filter(videoInfo => (
            searchCriteria.Video && searchCriteria.Video.includes(videoInfo.Title)
            && (
                (searchCriteria.Season == undefined || searchCriteria.Season.includes(videoInfo.Season + ''))
                &&
                (searchCriteria.Episode == undefined || searchCriteria.Episode.includes(videoInfo.Episode + ''))
            )
        ))
        if (filteredVideos.length > 0) {
            return filteredVideos[0].Id
        }
    }
    async SearchAndPlay(payload: RemoteVideoPlayer.RequestPayload): Promise<Response> {
        const searchCriteria: VideoSearchCriteria = convertEntities(payload.entities);
        const recordedId = await this.findRecordedId(searchCriteria);
        if (recordedId) {
            const stateMonitor = this.getPlaybackStateMonitor()
            await this.fe.PlayRecording({
                RecordedId: recordedId
            })
            return {
                payload: {},
                state: await stateMonitor
            }
        } else {
            const videoId = await this.findVideoId(searchCriteria);
            if (videoId) {
                return this.playVideo(videoId);
            } else {
                console.log('video not found %j', payload)
                return {
                    payload: {}
                }
            }
        }
    }
    private getPlaybackStateMonitor() {
        return this.fe.monitorStateChange(PlaybackStateReporter.namespace, {
            name: 'playbackState',
            value: {
                state: 'PLAYING'
            }
        })
    }
    private async playVideo(videoId: number) {
        if (this.fe.isWatching()) {
            const stoppedTv = this.fe.monitorMythEvent('PLAY_STOPPED', STATE_EVENT_TIMEOUT);
            await this.fe.SendAction({
                Action: 'STOPPLAYBACK'
            })
            await stoppedTv;
        }
        const stateMonitor = this.getPlaybackStateMonitor()
        await this.fe.PlayVideo({
            Id: videoId + '',
            UseBookmark: false
        })
        return {
            payload: {},
            state: await stateMonitor
        }
    }
    async SearchAndDisplayResults(payload: RemoteVideoPlayer.RequestPayload): Promise<Response> {
        return {
            payload: {}
        };
    }
}

type VideoSearchCriteria = {
    [K in keyof Video.NamedEntity]?: Array<Video.NamedEntity[K]['value']>
}

function convertEntities(entities: Video.Entity[]): VideoSearchCriteria {
    const searchCriteria: VideoSearchCriteria = entities
        .map(entity => ({
            [entity.type]: [entity.value]
        }
        )).reduce((prev: VideoSearchCriteria, initial: VideoSearchCriteria) => {
            Object.keys(initial).forEach(key => {
                if (prev[key]) {
                    prev[key] = [...prev[key], ...initial[key]]
                } else {
                    prev[key] = initial[key];
                }
            })
            return prev;
        })
    Object.keys(searchCriteria).forEach(key => {
        searchCriteria[key] = [...new Set(searchCriteria[key])]
    })
    return searchCriteria;
}