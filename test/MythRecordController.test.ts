import { RecordController } from '@vestibule-link/alexa-video-skill-types';
import { expect } from 'chai';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythRecordController';
import { createBackendNock, createFrontendNock, createMockFrontend, MockMythAlexaEventFrontend, verifyActionDirective, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';


describe('MythRecordController', () => {
    const sandbox = createSandbox()
    let frontend: MockMythAlexaEventFrontend
    let handler: Handler
    before(async () => {
        frontend = await createMockFrontend('record');
        handler = new Handler(frontend)
    })
    afterEach(() => {
        sandbox.restore()
        frontend.resetDeltaId()
    })
    function createDvrEncoderListNock(recGroup: string) {
        return createBackendNock('Dvr')
            .get("/GetEncoderList").reply(200, () => {
                return {
                    EncoderList: {
                        Encoders: [{
                            Id: 1,
                            Connected: true,
                            Recording: {
                                Channel: {
                                    ChanId: "100"
                                },
                                Recording: {
                                    RecGroup: recGroup
                                },
                                ProgramId: 'PROG123'
                            }
                        }]
                    }
                }
            })
    }
    context('directives', () => {
        it('StartRecording should send TOGGLERECORD action', async () => {
            await verifyActionDirective(sandbox, frontend, RecordController.namespace, 'StartRecording', {}, [{
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
                })
        })
        it('StopRecording should send TOGGLERECORD action', async () => {
            await verifyActionDirective(sandbox, frontend, RecordController.namespace, 'StopRecording', {}, [{
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
                })
        })
    })
    context('MythtTV Events', () => {
        it('SCHEDULER_RAN should refresh state', async () => {
            const dvrNock = createDvrEncoderListNock('RegGroup')
            const feNock = createFrontendNock(frontend.hostname())
                .get('/GetStatus')
                .twice()
                .reply(200, () => {
                    return {
                        FrontendStatus: {
                            State: {
                                state: 'WatchingLiveTV',
                                chanid: '100',
                                programid: 'PROG123'
                            }
                        }
                    }
                })
            await verifyMythEventState(sandbox, frontend, 'SCHEDULER_RAN', {}, RecordController.namespace, 'RecordingState', 'RECORDING')
            expect(feNock.isDone()).to.be.true
            expect(dvrNock.isDone()).to.be.true

        })
    })
    context('Alexa Shadow', () => {
        afterEach(() => {
            sandbox.restore()
            frontend.resetDeltaId()
        })
        context('refreshState', () => {
            it('should emit RECORDING when watching a channel being recorded', async () => {
                const dvrNock = createDvrEncoderListNock('RegGroup')
                const feNock = createFrontendNock(frontend.hostname())
                    .get('/GetStatus')
                    .twice()
                    .reply(200, () => {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'WatchingLiveTV',
                                    chanid: '100',
                                    programid: 'PROG123'
                                }
                            }
                        }
                    })
                await verifyRefreshState(sandbox, frontend, RecordController.namespace, 'RecordingState', 'RECORDING')
                expect(feNock.isDone()).to.be.true
                expect(dvrNock.isDone()).to.be.true
            })
            it('should emit NOT_RECORDING not watching TV', async () => {
                const feNock = createFrontendNock(frontend.hostname())
                    .get('/GetStatus')
                    .reply(200, () => {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'MainMenu'
                                }
                            }
                        }
                    })
                await verifyRefreshState(sandbox, frontend, RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                expect(feNock.isDone()).to.be.true
            })
            it('should emit NOT_RECORDING watching a different channel', async () => {
                const dvrNock = createDvrEncoderListNock('RegGroup')
                const feNock = createFrontendNock(frontend.hostname())
                    .get('/GetStatus')
                    .twice()
                    .reply(200, () => {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'WatchingLiveTV',
                                    chanid: '1001',
                                    programid: 'PROG123'
                                }
                            }
                        }
                    })
                await verifyRefreshState(sandbox, frontend, RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                expect(feNock.isDone()).to.be.true
                expect(dvrNock.isDone()).to.be.true
            })
            it('should emit NOT_RECORDING recording group is LiveTV', async () => {
                const dvrNock = createDvrEncoderListNock('LiveTV')
                const feNock = createFrontendNock(frontend.hostname())
                    .get('/GetStatus')
                    .twice()
                    .reply(200, () => {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'WatchingLiveTV',
                                    chanid: '100',
                                    programid: 'PROG123'
                                }
                            }
                        }
                    })
                await verifyRefreshState(sandbox, frontend, RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                expect(feNock.isDone()).to.be.true
                expect(dvrNock.isDone()).to.be.true
            })
            it('should emit NOT_RECORDING program id doesnt match', async () => {
                const dvrNock = createDvrEncoderListNock('RegGroup')
                const feNock = createFrontendNock(frontend.hostname())
                    .get('/GetStatus')
                    .twice()
                    .reply(200, () => {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'WatchingLiveTV',
                                    chanid: '100',
                                    programid: 'PROG123X'
                                }
                            }
                        }
                    })
                await verifyRefreshState(sandbox, frontend, RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                expect(feNock.isDone()).to.be.true
                expect(dvrNock.isDone()).to.be.true
            })
        })
        it('refreshCapability should emit RecordingState', async () => {
            await verifyRefreshCapability(sandbox, frontend, false, RecordController.namespace, ['RecordingState'])
        })
    })

})