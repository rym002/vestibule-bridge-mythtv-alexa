import { RemoteVideoPlayer, Video } from "@vestibule-link/alexa-video-skill-types";
import { CapabilityEmitter, DirectiveHandlers, SupportedDirectives } from "@vestibule-link/bridge-assistant-alexa";
import { SubType, ErrorHolder } from "@vestibule-link/iot-types";
import { sortBy } from 'lodash';
import { masterBackend, ApiTypes } from "mythtv-services-api";
import { MythAlexaEventFrontend } from "./Frontend";


type DirectiveType = RemoteVideoPlayer.NamespaceType;
const DirectiveName: DirectiveType = RemoteVideoPlayer.namespace;
type Response = {
    payload: {}
}
export default class FrontendVideoPlayer
    implements SubType<DirectiveHandlers, DirectiveType>, CapabilityEmitter {
    readonly backend = masterBackend;
    readonly supported: SupportedDirectives<DirectiveType> = ['SearchAndPlay'];
    constructor(readonly fe: MythAlexaEventFrontend) {
        fe.alexaEmitter.on('refreshCapability', this.refreshCapability.bind(this));
        fe.alexaEmitter.registerDirectiveHandler(DirectiveName, this);
    }

    refreshCapability(deltaId: symbol): void {
        this.fe.alexaEmitter.emit('capability', DirectiveName, true, deltaId);
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
            await this.fe.PlayRecording({
                RecordedId: recordedId
            })
        } else {
            const videoId = await this.findVideoId(searchCriteria);
            if (videoId) {
                if (await this.fe.isWatching()) {
                    const stoppedTv = new Promise((resolve, reject) => {
                        const timer = setTimeout(() => {
                            const error: ErrorHolder = {
                                errorType: 'Alexa',
                                errorPayload: {
                                    type: 'ENDPOINT_BUSY',
                                    message: 'Failed to stop'
                                }
                            }
                            reject(error)
                        }, 1000);
                        this.fe.mythEventEmitter.once('PLAY_STOPPED', (message) => {
                            clearTimeout(timer)
                            resolve()
                        })
                    })
                    await this.fe.SendAction({
                        Action: 'STOPPLAYBACK'
                    })
                    await stoppedTv;
                }
                await this.fe.PlayVideo({
                    Id: videoId + '',
                    UseBookmark: false
                })
            }
        }

        return {
            payload: {}
        };
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