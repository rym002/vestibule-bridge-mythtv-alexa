import { RemoteVideoPlayer } from '@vestibule-link/alexa-video-skill-types';
import { expect } from 'chai';
import 'mocha';
import { ApiTypes } from 'mythtv-services-api';
import { createSandbox } from 'sinon';
import Handler from '../src/MythRemoteVideoPlayer';
import { createBackendNock, createFrontendNock, createMockFrontend, MockMythAlexaEventFrontend, toBool, verifyActionDirective, verifyRefreshCapability } from './MockHelper';
import { EventEmitter } from 'events';

describe('MythRemoteVideoPlayer', function () {
    const sandbox = createSandbox()
    beforeEach(async function () {
        const frontend = await createMockFrontend('remoteVideo');
        new Handler(frontend)
        this.currentTest['frontend'] = frontend
    })
    afterEach(function () {
        sandbox.restore()
    })
    context('directives', function () {
        context('SearchAndPlay', function () {
            function createProgram(RecordedId: number, Season: number, Episode: number, Airdate: Date): Partial<ApiTypes.Program> {
                return {
                    ProgramId: RecordedId + '',
                    Recording: {
                        RecordId: 123,
                        RecordedId: RecordedId,
                        RecGroup: 'TEST',
                        PlayGroup: "TEST",
                        Status: ApiTypes.RecStatusType.Recorded,
                        StorageGroup: 'ANY',
                        DupInType: 0,
                        DupMethod: 0,
                        Priority: 0,
                        EncoderId: 0,
                        EncoderName: '',
                        EndTs: new Date(),
                        StartTs: new Date(),
                        FileName: '',
                        FileSize: 0,
                        HostName: '',
                        LastModified: new Date(),
                        Profile: '',
                        RecType: 0
                    },
                    Airdate: Airdate,
                    Episode: Episode,
                    Season: Season
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

            function createDvrGetRecordedListNock(programs: Partial<ApiTypes.Program>[]) {
                return createBackendNock('Dvr')
                    .get('/GetRecordedList')
                    .query({
                        TitleRegEx: 'Test Video|Another Video'
                    }).reply(200, function () {
                        return {
                            ProgramList: {
                                Programs: programs
                            }
                        }
                    })
            }
            context('Recording', function () {
                const programs = [
                    createProgram(300, 2, 9, new Date()),
                    createProgram(200, 1, 10, new Date()),
                    createProgram(100, 1, 9, new Date())
                ]
                function createFrontendPlayRecordingNock(recordedId: number, frontend: MockMythAlexaEventFrontend) {
                    return createFrontendNock(frontend.hostname())
                        .post('/PlayRecording')
                        .query({
                            RecordedId: recordedId
                        }).reply(200, function () {
                            return toBool(true)
                        })
                }
                it('should play the requested season and episode', async function () {
                    const backendNock = createDvrGetRecordedListNock(programs)
                    const frontendNock = createFrontendPlayRecordingNock(200, this.test['frontend'])
                    await verifyActionDirective(this.test['frontend'], RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestSeason, [], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                    expect(backendNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true

                })
                it('should play the first episode based on season and episode if not in request', async function () {
                    const backendNock = createDvrGetRecordedListNock(programs)
                    const frontendNock = createFrontendPlayRecordingNock(100, this.test['frontend'])
                    await verifyActionDirective(this.test['frontend'], RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestNoSeason, [], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                    expect(backendNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true
                })
                it('should play the first episode based on airdate', async function () {
                    const programs = [
                        createProgram(300, 0, 0, new Date('2019-09-01')),
                        createProgram(200, 0, 0, new Date('2019-08-01')),
                        createProgram(100, 0, 0, new Date('2019-07-30'))
                    ]
                    const backendNock = createDvrGetRecordedListNock(programs)
                    const frontendNock = createFrontendPlayRecordingNock(100, this.test['frontend'])
                    await verifyActionDirective(this.test['frontend'], RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestNoSeason, [], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                    expect(backendNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true

                })
            })
            context('Video', function () {
                function createVideoGetVideoListNock(videos: Partial<ApiTypes.VideoMetadataInfo>[]) {
                    return createBackendNock('Video')
                        .get('/GetVideoList')
                        .query({
                        }).reply(200, function () {
                            return {
                                VideoMetadataInfoList: {
                                    VideoMetadataInfos: videos
                                }
                            }
                        })
                }
                function createProgram(Id: number, Title: string, Season: number, Episode: number): Partial<ApiTypes.VideoMetadataInfo> {
                    return {
                        Id: Id,
                        Title: Title,
                        Season: Season,
                        Episode: Episode
                    }
                }
                const testVideos: Partial<ApiTypes.VideoMetadataInfo>[] = [
                    createProgram(300, 'Another Video', 2, 9),
                    createProgram(200, 'Another Video', 1, 10),
                    createProgram(100, 'Another Video', 1, 9)
                ]
                function createFrontendPlayVideoNock(videoId: number, state: string, frontend: MockMythAlexaEventFrontend) {
                    return createFrontendNock(frontend.hostname())
                        .get('/GetStatus')
                        .reply(200, function () {
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
                        }).reply(200, function () {
                            return toBool(true)
                        })
                }
                it('should play the first video', async function () {
                    const backendDvrNock = createDvrGetRecordedListNock([])
                    const backendVideoNock = createVideoGetVideoListNock(testVideos)
                    const frontendNock = createFrontendPlayVideoNock(300, 'MainMenu', this.test['frontend'])
                    await verifyActionDirective(this.test['frontend'], RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestNoSeason, [], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                    expect(backendDvrNock.isDone()).to.be.true
                    expect(backendVideoNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true

                })
                it('should play the first video based on episode', async function () {
                    const backendDvrNock = createDvrGetRecordedListNock([])
                    const backendVideoNock = createVideoGetVideoListNock(testVideos)
                    const frontendNock = createFrontendPlayVideoNock(200, 'MainMenu', this.test['frontend'])
                    await verifyActionDirective(this.test['frontend'], RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestSeason, [], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                    expect(backendDvrNock.isDone()).to.be.true
                    expect(backendVideoNock.isDone()).to.be.true
                    expect(frontendNock.isDone()).to.be.true
                })
                it('should stop playback if watching tv', async function () {
                    const backendDvrNock = createDvrGetRecordedListNock([])
                    const backendVideoNock = createVideoGetVideoListNock(testVideos)
                    const frontendNock = createFrontendPlayVideoNock(200, 'WatchingLiveTV', this.test['frontend'])
                    const mythEmitter = <EventEmitter>this.test['frontend'].mythEventEmitter;
                    mythEmitter.once('newListener', (event, listener) => {
                        if (event == 'PLAY_STOPPED') {
                            process.nextTick(() => {
                                mythEmitter.emit('PLAY_STOPPED', {})
                            })
                        }
                    })
                    await verifyActionDirective(this.test['frontend'], RemoteVideoPlayer.namespace, 'SearchAndPlay', testRequestSeason, [{
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
    context('Alexa Shadow', function () {
        it('refreshCapability should emit true', async function () {
            await verifyRefreshCapability(sandbox, this.test['frontend'], false, RemoteVideoPlayer.namespace, true)
        })
    })

})