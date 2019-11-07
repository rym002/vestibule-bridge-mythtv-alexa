import { RecordController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import Handler from '../src/MythRecordController';
import { createContextSandbox, createFrontendNock, createMockFrontend, getContextSandbox, getFrontend, restoreSandbox, verifyActionDirective, verifyMythEventState, verifyRefreshCapability, verifyRefreshState, createBackendNock } from './MockHelper';


describe('MythRecordController', function () {
    beforeEach(async function () {
        createContextSandbox(this)
        const frontend = await createMockFrontend('record', this);
        new Handler(frontend)
    })
    afterEach(function () {
        restoreSandbox(this)
    })
    context('directives', function () {
        it('StartRecording should send TOGGLERECORD action', async function () {
            await verifyActionDirective(getFrontend(this), RecordController.namespace, 'StartRecording', {}, [{
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
            await verifyActionDirective(getFrontend(this), RecordController.namespace, 'StopRecording', {}, [{
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
            frontend.mythEventEmitter.emit('PLAY_CHANGED', {
                SENDER: '',
                CHANID: '201',
                RECORDEDID: '100'
            })
            createBackendNock('Dvr')
                .get('/GetRecorded')
                .query({
                    RecordedId: 100
                })
                .reply(200, {
                    Program: {
                        Recording: {
                            RecGroup: 'Default'
                        }
                    }
                })
            await verifyMythEventState(frontend, 'SCHEDULER_RAN', {
                SENDER: ''
            }, RecordController.namespace, 'RecordingState', 'RECORDING', true)
        })
        it('REC_STARTED should update ChanIdRequest StartTime if watching CHANID', async function () {
            const frontend = getFrontend(this);
            frontend.mythEventEmitter.emit('PLAY_CHANGED', {
                SENDER: '',
                CHANID: '202',
                RECORDEDID: '101'
            })
            frontend.masterBackendEmitter.emit('REC_STARTED', {
                SENDER: '',
                CHANID: '202',
                RECGROUP: 'LiveTV',
                RECORDEDID: '102'
            })
            createBackendNock('Dvr')
                .get('/GetRecorded')
                .query({
                    RecordedId: 102
                })
                .reply(200, {
                    Program: {
                        Recording: {
                            RecGroup: 'Default'
                        }
                    }
                })
            await verifyMythEventState(frontend, 'SCHEDULER_RAN', {
                SENDER: ''
            }, RecordController.namespace, 'RecordingState', 'RECORDING', true)
        })
        it('REC_STARTED should not update ChanIdRequest StartTime if different CHANID', async function () {
            const frontend = getFrontend(this);
            frontend.mythEventEmitter.emit('PLAY_CHANGED', {
                SENDER: '',
                CHANID: '202',
                RECORDEDID: '103'
            })
            frontend.masterBackendEmitter.emit('REC_STARTED', {
                SENDER: '',
                CHANID: '200',
                RECGROUP: 'LiveTV',
                RECORDEDID: '201'
            })
            createBackendNock('Dvr')
                .get('/GetRecorded')
                .query({
                    RecordedId: 103
                })
                .reply(200, {
                    Program: {
                        Recording: {
                            RecGroup: 'Default'
                        }
                    }
                })
            await verifyMythEventState(frontend, 'SCHEDULER_RAN', {
                SENDER: ''
            }, RecordController.namespace, 'RecordingState', 'RECORDING', true)
        })
        it('PLAY_CHANGED should emit NOT_RECORDING', async function () {
            const frontend = getFrontend(this);
            await verifyMythEventState(frontend, 'PLAY_CHANGED', {
                SENDER: '',
                CHANID: '202',
                RECGROUP: 'LiveTV',
                RECORDEDID: '201'
            }, RecordController.namespace, 'RecordingState', 'NOT_RECORDING', false)
        })
        it('REC_STARTED should emit NOT_RECORDING', async function () {
            const frontend = getFrontend(this);
            frontend.mythEventEmitter.emit('PLAY_CHANGED', {
                SENDER: '',
                CHANID: '202',
                RECORDEDID: '201'
            })
            await verifyMythEventState(frontend, 'REC_STARTED', {
                SENDER: '',
                CHANID: '202',
                RECGROUP: 'LiveTV',
                RECORDEDID: '201'
            }, RecordController.namespace, 'RecordingState', 'NOT_RECORDING', true)
        })
        it('LIVETV_ENDED should emit NOT_RECORDING', async function () {
            const frontend = getFrontend(this);
            await verifyMythEventState(frontend, 'LIVETV_ENDED', {
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
                        await verifyRefreshState(getFrontend(this), RecordController.namespace, 'RecordingState', 'RECORDING')
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
                        await verifyRefreshState(getFrontend(this), RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
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
                        await verifyRefreshState(getFrontend(this), RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
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
                    await verifyRefreshState(getFrontend(this), RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                })
            })
        })
        it('refreshCapability should emit RecordingState', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, RecordController.namespace, ['RecordingState'])
        })
    })

})