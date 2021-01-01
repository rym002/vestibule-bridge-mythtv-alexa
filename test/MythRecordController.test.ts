import { RecordController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import Handler from '../src/MythRecordController';
import { convertDateParams, createBackendNock, createFrontendNock, createMockFrontend, getConnectionHandlerStub, getContextSandbox, getFrontend, getTopicHandlerMap, verifyActionDirective, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';


describe('MythRecordController', function () {
    beforeEach(async function () {
        const frontend = await createMockFrontend('record', this);
        new Handler(frontend)
    })
    context('directives', function () {
        it('StartRecording should send TOGGLERECORD action', async function () {
            await verifyActionDirective(getFrontend(this),
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this),
                RecordController.namespace, 'StartRecording', {}, [{
                    actionName: 'TOGGLERECORD',
                    response: true
                }], {
                error: false,
                payload: {},
                stateChange: {
                    'Alexa.RecordController': {
                        RecordingState: 'RECORDING'
                    }
                }
            }, {
                'Alexa.RecordController': {
                    RecordingState: 'RECORDING'
                }
            })
        })
        it('StopRecording should send TOGGLERECORD action', async function () {
            await verifyActionDirective(getFrontend(this),
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this),
                RecordController.namespace, 'StopRecording', {}, [{
                    actionName: 'TOGGLERECORD',
                    response: true
                }], {
                error: false,
                payload: {},
                stateChange: {
                    'Alexa.RecordController': {
                        RecordingState: 'NOT_RECORDING'
                    }
                }
            }, {
                'Alexa.RecordController': {
                    RecordingState: 'NOT_RECORDING'
                }
            })
        })
    })
    context('MythtTV Events', function () {
        beforeEach(function () {
            const frontend = getFrontend(this);
            frontend.mythEventEmitter.emit('LIVETV_STARTED', {
                SENDER: ''
            })
        })
        it('PLAY_CHANGED should provide ChanIdRequest', async function () {
            const frontend = getFrontend(this);
            const startTime = new Date('2020-01-10T01:00:10Z')
            frontend.mythEventEmitter.emit('PLAY_CHANGED', {
                SENDER: '',
                CHANID: '201',
                STARTTIME: startTime
            })
            const request = {
                ChanId: 201,
                StartTime: startTime
            }
            createBackendNock('Dvr')
                .get('/GetRecorded')
                .query({
                    ...request,
                    ...convertDateParams(request, ['StartTime'])
                }).reply(200, {
                    Program: {
                        Recording: {
                            RecGroup: 'Default'
                        }
                    }
                })
            await verifyMythEventState(getContextSandbox(this),
                frontend, 'SCHEDULER_RAN', {
                SENDER: ''
            }, RecordController.namespace, 'RecordingState', 'RECORDING', true)
        })
        it('REC_STARTED should update ChanIdRequest StartTime if watching CHANID', async function () {
            const frontend = getFrontend(this);
            const startTime = new Date('2020-01-10T02:00:10Z')
            frontend.mythEventEmitter.emit('PLAY_CHANGED', {
                SENDER: '',
                CHANID: '202',
                STARTTIME: startTime
            })
            const startTime2 = new Date('2020-01-10T02:10:10Z')
            frontend.masterBackendEmitter.emit('REC_STARTED', {
                SENDER: '',
                CHANID: '202',
                STARTTIME: startTime2
            })
            const request = {
                ChanId: 202,
                StartTime: startTime2
            }
            createBackendNock('Dvr')
                .get('/GetRecorded')
                .query({
                    ...request,
                    ...convertDateParams(request, ['StartTime'])
                })
                .reply(200, {
                    Program: {
                        Recording: {
                            RecGroup: 'Default'
                        }
                    }
                })
            await verifyMythEventState(getContextSandbox(this),
                frontend, 'SCHEDULER_RAN', {
                SENDER: ''
            }, RecordController.namespace, 'RecordingState', 'RECORDING', true)
        })
        it('REC_STARTED should not update ChanIdRequest StartTime if different CHANID', async function () {
            const frontend = getFrontend(this);
            const startTime = new Date('2020-01-10T03:00:10Z')
            frontend.mythEventEmitter.emit('PLAY_CHANGED', {
                SENDER: '',
                CHANID: '202',
                STARTTIME: startTime
            })
            frontend.masterBackendEmitter.emit('REC_STARTED', {
                SENDER: '',
                CHANID: '200',
                STARTTIME: startTime
            })
            const request = {
                ChanId: 202,
                StartTime: startTime
            }
            createBackendNock('Dvr')
                .get('/GetRecorded')
                .query({
                    ...request,
                    ...convertDateParams(request, ['StartTime'])
                })
                .reply(200, {
                    Program: {
                        Recording: {
                            RecGroup: 'Default'
                        }
                    }
                })
            await verifyMythEventState(getContextSandbox(this),
                frontend, 'SCHEDULER_RAN', {
                SENDER: ''
            }, RecordController.namespace, 'RecordingState', 'RECORDING', true)
        })
        it('PLAY_CHANGED should emit NOT_RECORDING', async function () {
            const frontend = getFrontend(this);
            const startTime = new Date('2020-01-10T04:00:10Z')
            await verifyMythEventState(getContextSandbox(this),
                frontend, 'PLAY_CHANGED', {
                SENDER: '',
                CHANID: '202',
                STARTTIME: startTime
            }, RecordController.namespace, 'RecordingState', 'NOT_RECORDING', false)
        })
        it('REC_STARTED should emit NOT_RECORDING', async function () {
            const frontend = getFrontend(this);
            const startTime = new Date('2020-01-10T05:00:10Z')
            frontend.mythEventEmitter.emit('PLAY_CHANGED', {
                SENDER: '',
                CHANID: '202',
                STARTTIME: startTime
            })
            await verifyMythEventState(getContextSandbox(this),
                frontend, 'REC_STARTED', {
                SENDER: '',
                CHANID: '202',
                STARTTIME: startTime
            }, RecordController.namespace, 'RecordingState', 'NOT_RECORDING', true)
        })
        it('LIVETV_ENDED should emit NOT_RECORDING', async function () {
            const frontend = getFrontend(this);
            await verifyMythEventState(getContextSandbox(this),
                frontend, 'LIVETV_ENDED', {
                SENDER: ''
            }, RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
        })
    })
    context('Alexa Shadow', function () {
        context('refreshState', function () {
            context('watching', function () {
                beforeEach(function () {
                    const frontend = getFrontend(this)
                    frontend.mythEventEmitter.emit('PLAY_STARTED', {
                        SENDER: ''
                    })
                })
                context('watchingTv', function () {
                    beforeEach(function () {
                        const frontend = getFrontend(this)
                        frontend.mythEventEmitter.emit('LIVETV_STARTED', {
                            SENDER: ''
                        })
                        const feNock = createFrontendNock(frontend.hostname())
                            .get('/GetStatus')
                            .reply(200, function () {
                                return {
                                    FrontendStatus: {
                                        State: {
                                            state: 'WatchingLiveTV',
                                            chanid: '200' + frontend.hostname(),
                                            starttime: '2019-11-05T00:00:00Z'
                                        }
                                    }
                                }
                            })
                    })
                    it('should emit RECORDING when RecGroup!=LiveTV', async function () {
                        createBackendNock('Dvr')
                            .get('/GetRecorded')
                            .query({
                                ChanId: '200' + getFrontend(this).hostname(),
                                StartTime: '2019-11-05T00:00:00'
                            })
                            .reply(200, {
                                Program: {
                                    Recording: {
                                        RecGroup: 'Default'
                                    }
                                }
                            })
                        await verifyRefreshState(getContextSandbox(this),
                            getFrontend(this), RecordController.namespace, 'RecordingState', 'RECORDING')
                    })
                    it('should emit NOT_RECORDING when RecGroup==LiveTV', async function () {
                        createBackendNock('Dvr')
                            .get('/GetRecorded')
                            .query({
                                ChanId: '200' + getFrontend(this).hostname(),
                                StartTime: '2019-11-05T00:00:00'
                            })
                            .reply(200, {
                                Program: {
                                    Recording: {
                                        RecGroup: 'LiveTV'
                                    }
                                }
                            })
                        await verifyRefreshState(getContextSandbox(this),
                            getFrontend(this), RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                    })
                })
                context('not watchingTv', function () {
                    beforeEach(function () {
                        const frontend = getFrontend(this)
                        frontend.mythEventEmitter.emit('LIVETV_ENDED', {
                            SENDER: ''
                        })
                    })
                    it('should emit NOT_RECORDING', async function () {
                        await verifyRefreshState(getContextSandbox(this),
                            getFrontend(this), RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                    })
                })
            })
            context('Not watching', function () {
                beforeEach(function () {
                    const frontend = getFrontend(this)
                    frontend.mythEventEmitter.emit('PLAY_STOPPED', {
                        SENDER: ''
                    })
                })
                it('should emit NOT_RECORDING', async function () {
                    await verifyRefreshState(getContextSandbox(this),
                        getFrontend(this), RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                })
            })
        })
        it('refreshCapability should emit RecordingState', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, RecordController.namespace, ['RecordingState'])
        })
    })

})