import { RecordController } from '@vestibule-link/alexa-video-skill-types';
import { expect } from 'chai';
import 'mocha';
import { Scope } from 'nock';
import { createSandbox } from 'sinon';
import Handler from '../src/MythRecordController';
import { createBackendNock, createFrontendNock, createMockFrontend, verifyActionDirective, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';


describe('MythRecordController', function () {
    const sandbox = createSandbox()
    let dvrNock:Scope;
    beforeEach(async function () {
        const frontend = await createMockFrontend('record');
        new Handler(frontend)
        this.currentTest['frontend'] = frontend;
    })
    afterEach(function () {
        sandbox.restore()
    })
    before(function () {
        dvrNock = createBackendNock('Dvr')
            .get("/GetEncoderList")
            .times(5)
            .reply(200, function () {
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
                                    RecGroup: 'LiveTV'
                                },
                                ProgramId: 'PROG123'
                            }
                        }, {
                            Id: 2,
                            Connected: true,
                            Recording: {
                                Channel: {
                                    ChanId: "200"
                                },
                                Recording: {
                                    RecGroup: 'RecGroup1'
                                },
                                ProgramId: 'PROG456'
                            }
                        }]
                    }
                }
            })
    })
    after(function(){
        dvrNock.restore()
    })
    context('directives', function () {
        it('StartRecording should send TOGGLERECORD action', async function () {
            await verifyActionDirective(this.test['frontend'], RecordController.namespace, 'StartRecording', {}, [{
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
        it('StopRecording should send TOGGLERECORD action', async function () {
            await verifyActionDirective(this.test['frontend'], RecordController.namespace, 'StopRecording', {}, [{
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
    context('MythtTV Events', function () {
        it('SCHEDULER_RAN should refresh state', async function () {
            const feNock = createFrontendNock(this.test['frontend'].hostname())
                .get('/GetStatus')
                .twice()
                .reply(200, function () {
                    return {
                        FrontendStatus: {
                            State: {
                                state: 'WatchingLiveTV',
                                chanid: '200',
                                programid: 'PROG456'
                            }
                        }
                    }
                })
            await verifyMythEventState(this.test['frontend'], 'SCHEDULER_RAN', {}, RecordController.namespace, 'RecordingState', 'RECORDING')
            expect(feNock.isDone()).to.be.true
        })
    })
    context('Alexa Shadow', function () {
        context('refreshState', function () {
            it('should emit RECORDING when watching a channel being recorded', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
                    .get('/GetStatus')
                    .twice()
                    .reply(200, function () {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'WatchingLiveTV',
                                    chanid: '200',
                                    programid: 'PROG456'
                                }
                            }
                        }
                    })
                await verifyRefreshState(this.test['frontend'], RecordController.namespace, 'RecordingState', 'RECORDING')
                expect(feNock.isDone()).to.be.true
            })
            it('should emit NOT_RECORDING not watching TV', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
                    .get('/GetStatus')
                    .reply(200, function () {
                        return {
                            FrontendStatus: {
                                State: {
                                    state: 'MainMenu'
                                }
                            }
                        }
                    })
                await verifyRefreshState(this.test['frontend'], RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                expect(feNock.isDone()).to.be.true
            })
            it('should emit NOT_RECORDING watching a different channel', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
                    .get('/GetStatus')
                    .twice()
                    .reply(200, function () {
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
                await verifyRefreshState(this.test['frontend'], RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                expect(feNock.isDone()).to.be.true
            })
            it('should emit NOT_RECORDING recording group is LiveTV', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
                    .get('/GetStatus')
                    .twice()
                    .reply(200, function () {
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
                await verifyRefreshState(this.test['frontend'], RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                expect(feNock.isDone()).to.be.true
            })
            it('should emit NOT_RECORDING program id doesnt match', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
                    .get('/GetStatus')
                    .twice()
                    .reply(200, function () {
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
                await verifyRefreshState(this.test['frontend'], RecordController.namespace, 'RecordingState', 'NOT_RECORDING')
                expect(feNock.isDone()).to.be.true
            })
        })
        it('refreshCapability should emit RecordingState', async function () {
            await verifyRefreshCapability(sandbox, this.test['frontend'], false, RecordController.namespace, ['RecordingState'])
        })
    })

})