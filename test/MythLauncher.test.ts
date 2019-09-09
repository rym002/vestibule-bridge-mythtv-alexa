import { Launcher } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythLauncher';
import { createMockFrontend, MockMythAlexaEventFrontend, verifyActionDirective, verifyRefreshCapability, createFrontendNock } from './MockHelper';


describe('MythLauncher', () => {
    const sandbox = createSandbox()
    let frontend: MockMythAlexaEventFrontend
    let handler: Handler
    before(async () => {
        frontend = await createMockFrontend('launcher');
        handler = new Handler(frontend)
    })
    afterEach(() => {
        sandbox.restore()
        frontend.resetDeltaId()
    })
    context('directives', () => {
        context('LaunchTarget', () => {
            context('WatchingLiveTV', () => {
                beforeEach(() => {
                    const feNock = createFrontendNock(frontend.hostname())
                        .get('/GetStatus')
                        .reply(200, () => {
                            return {
                                FrontendStatus: {
                                    State: {
                                        state: 'WatchingLiveTV'
                                    }
                                }
                            }
                        })
                })
                it('68228 should send GUIDE action', async () => {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.68228',
                        name: 'Guide'
                    }
                    await verifyActionDirective(sandbox, frontend, Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'GUIDE',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                })
            })
            context('Not WatchingLiveTV', () => {
                beforeEach(() => {
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
                })
                it('69247 should send TV Recording Playback action', async () => {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.69247',
                        name: 'DVR'
                    }
                    await verifyActionDirective(sandbox, frontend, Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'TV Recording Playback',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                })
                it('68228 should send Program Guide action', async () => {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.68228',
                        name: 'Guide'
                    }
                    await verifyActionDirective(sandbox, frontend, Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'Program Guide',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                })
                it('33122 should send Main Menu action', async () => {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.33122',
                        name: 'Home'
                    }
                    await verifyActionDirective(sandbox, frontend, Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'Main Menu',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                })
                it('82117 should send INFO action', async () => {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.82117',
                        name: 'Info'
                    }
                    await verifyActionDirective(sandbox, frontend, Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'INFO',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                })
                it('84333 should send Live TV action', async () => {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.84333',
                        name: 'On Now'
                    }
                    await verifyActionDirective(sandbox, frontend, Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'Live TV',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                })
                it('06715 should send TOGGLEPIPMODE action', async () => {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.06715',
                        name: 'Picture in Picture'
                    }
                    await verifyActionDirective(sandbox, frontend, Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'TOGGLEPIPMODE',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                })
                it('52304 should send TV Recording Playback action', async () => {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.52304',
                        name: 'Recordings'
                    }
                    await verifyActionDirective(sandbox, frontend, Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'TV Recording Playback',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                })
                it('48625 should send Manage Recordings / Fix Conflicts action', async () => {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.48625',
                        name: 'Scheduled Recordings'
                    }
                    await verifyActionDirective(sandbox, frontend, Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'Manage Recordings / Fix Conflicts',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                })
                it('82307 should send Video Default action', async () => {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.82307',
                        name: 'VOD'
                    }
                    await verifyActionDirective(sandbox, frontend, Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'Video Default',
                        response: true
                    }], {
                            error: false,
                            payload: {},
                            stateChange: undefined
                        })
                })
            })
        })
    })
    context('Alexa Shadow', () => {
        it('refreshCapability should emit true', async () => {
            await verifyRefreshCapability(sandbox, frontend, false, Launcher.namespace, true)
        })
    })

})