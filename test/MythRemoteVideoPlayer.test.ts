import { RemoteVideoPlayer } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythRemoteVideoPlayer';
import { createMockFrontend, MockMythAlexaEventFrontend, verifyActionDirective, verifyRefreshCapability, createFrontendNock, createBackendNock, toBool } from './MockHelper';
import { Program, RecStatusType } from 'mythtv-services-api'
import { expect } from 'chai'
import { VideoMetadataInfo } from 'mythtv-services-api/dist/VideoService';

describe('MythRemoteVideoPlayer', () => {
    const sandbox = createSandbox()
    let frontend: MockMythAlexaEventFrontend
    let handler: Handler
    before(async () => {
        frontend = await createMockFrontend('remoteVideo');
        handler = new Handler(frontend)
    })
    afterEach(() => {
        sandbox.restore()
        frontend.resetDeltaId()
    })
    context('directives', () => {
        context('SearchAndPlay', () => {
            function createProgram(RecordedId: number, Season: number, Episode: number, Airdate: Date): Partial<Program> {
                return {
                    ProgramId: RecordedId + '',
                    Recording: {
                        RecordId: 123,
                        RecordedId: RecordedId,
                        RecGroup: 'TEST',
                        PlayGroup: "TEST",
                        Status: RecStatusType.Recorded,
                        StorageGroup: 'ANY'
                    },
                    Airdate: Airdate.toISOString().substring(0, 10),
                    Episode: Episode + '',
                    Season: Season + ''
                }

            }
            const testRequestNoSeason: RemoteVideoPlayer.RequestPayload = {
                entities: [
                    {
                        type: 'Video',
                        value: 'Test Video',
                        externalIds: {}
                    },
                    {
                        type: 'Video',
                        value: 'Another Video',
                        externalIds: {}
                    }

                ],
                timeWindow: {
                    start: new Date(),
                    end: new Date()
                }
            }
            const testRequestSeason: RemoteVideoPlayer.RequestPayload = {
                entities: [
                    {
                        type: 'Video',
                        value: 'Test Video',
                        externalIds: {}
                    },
                    {
                        type: 'Video',
                        value: 'Another Video',
                        externalIds: {}
                    },
                    {
                        type: 'Season',
                        value: '1'
                    },
                    {
                        type: 'Episode',
                        value: '10'
                    }

                ],
                timeWindow: {
                    start: new Date(),
                    end: new Date()
                }
            }

            function createDvrGetRecordedListNock(programs: Partial<Program>[]) {
                return createBackendNock('Dvr')
                    .get('/GetRecordedList')
                    .query({
                        TitleRegEx: 'Test Video|Another Video'
                    }).reply(200, () => {
                        return {
                            ProgramList: {
                                Programs: programs
                            }
                        }
                    })
            }
            context('Recording', () => {
                const programs = [
                    createProgram(300, 2, 9, new Date()),
                    createProgram(200, 1, 10, new Date()),
                    createProgram(100, 1, 9, new Date())
                ]
                function createFrontendPlayRecordingNock(recordedId: number) {
                    return createFrontendNock(frontend.hostname())
                        .post('/PlayRecording')
                        .query({
                            RecordedId: recordedId
                        }).reply(200, () => {
                            return toBool(true)
                        })
                }
                it('should play the requested season and episode', async () => {
                    const backendNock = createDvrGetRecordedListNock(programs)
                    const frontendNock = createFrontendPlayRecordingNock(200)
                    await verifyActionDirective(sandbox, frontend, RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestSeason, [], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                    expect(backendNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true

                })
                it('should play the first episode based on season and episode if not in request', async () => {
                    const backendNock = createDvrGetRecordedListNock(programs)
                    const frontendNock = createFrontendPlayRecordingNock(100)
                    await verifyActionDirective(sandbox, frontend, RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestNoSeason, [], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                    expect(backendNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true
                })
                it('should play the first episode based on airdate', async () => {
                    const programs = [
                        createProgram(300, 0, 0, new Date('2019-09-01')),
                        createProgram(200, 0, 0, new Date('2019-08-01')),
                        createProgram(100, 0, 0, new Date('2019-07-30'))
                    ]
                    const backendNock = createDvrGetRecordedListNock(programs)
                    const frontendNock = createFrontendPlayRecordingNock(100)
                    await verifyActionDirective(sandbox, frontend, RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestNoSeason, [], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                    expect(backendNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true

                })
            })
            context('Video', () => {
                function createVideoGetVideoListNock(videos: Partial<VideoMetadataInfo>[]) {
                    return createBackendNock('Video')
                        .get('/GetVideoList')
                        .query({
                        }).reply(200, () => {
                            return {
                                VideoMetadataInfoList: {
                                    VideoMetadataInfos: videos
                                }
                            }
                        })
                }
                function createProgram(Id: number, Title: string, Season: number, Episode: number): Partial<VideoMetadataInfo> {
                    return {
                        Id: Id,
                        Title: Title,
                        Season: Season + '',
                        Episode: Episode + ''
                    }
                }
                const testVideos: Partial<VideoMetadataInfo>[] = [
                    createProgram(300, 'Another Video', 2, 9),
                    createProgram(200, 'Another Video', 1, 10),
                    createProgram(100, 'Another Video', 1, 9)
                ]
                function createFrontendPlayVideoNock(videoId: number, state: string) {
                    return createFrontendNock(frontend.hostname())
                        .get('/GetStatus')
                        .reply(200, () => {
                            return {
                                FrontendStatus: {
                                    State: {
                                        state: state
                                    }
                                }
                            }
                        }).post('/PlayVideo')
                        .query({
                            Id: videoId + '',
                            UseBookmark: false
                        }).reply(200, () => {
                            return toBool(true)
                        })
                }
                it('should play the first video', async () => {
                    const backendDvrNock = createDvrGetRecordedListNock([])
                    const backendVideoNock = createVideoGetVideoListNock(testVideos)
                    const frontendNock = createFrontendPlayVideoNock(300, 'MainMenu')
                    await verifyActionDirective(sandbox, frontend, RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestNoSeason, [], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                    expect(backendDvrNock.isDone()).to.be.true
                    expect(backendVideoNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true

                })
                it('should play the first video based on episode', async () => {
                    const backendDvrNock = createDvrGetRecordedListNock([])
                    const backendVideoNock = createVideoGetVideoListNock(testVideos)
                    const frontendNock = createFrontendPlayVideoNock(200, 'MainMenu')
                    await verifyActionDirective(sandbox, frontend, RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestSeason, [], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                    expect(backendDvrNock.isDone()).to.be.true
                    expect(backendVideoNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true
                })
                it('should stop playback if watching tv', async () => {
                    const backendDvrNock = createDvrGetRecordedListNock([])
                    const backendVideoNock = createVideoGetVideoListNock(testVideos)
                    const frontendNock = createFrontendPlayVideoNock(200, 'WatchingLiveTV')
                    await verifyActionDirective(sandbox, frontend, RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestSeason, [{
                        actionName: 'STOPPLAYBACK',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                    expect(backendDvrNock.isDone()).to.be.true
                    expect(backendVideoNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true

                })
            })
        })
    })
    context('Alexa Shadow', () => {
        it('refreshCapability should emit true', async () => {
            await verifyRefreshCapability(sandbox, frontend, false, RemoteVideoPlayer.namespace, true)
        })
    })

})