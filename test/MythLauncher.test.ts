import { Launcher } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythLauncher';
import { createFrontendNock, createMockFrontend, verifyActionDirective, verifyRefreshCapability } from './MockHelper';


describe('MythLauncher', function () {
    const sandbox = createSandbox()
    beforeEach(async function () {
        const frontend = await createMockFrontend('launcher');
        new Handler(frontend)
        this.currentTest['frontend'] = frontend
    })
    afterEach(function () {
        sandbox.restore()
    })
    context('directives', function () {
        context('LaunchTarget', function () {
            context('WatchingLiveTV', function () {
                beforeEach(function () {
                    const frontend = this.currentTest['frontend']
                    const feNock = createFrontendNock(frontend.hostname())
                        .get('/GetStatus')
                        .reply(200, function () {
                            return {
                                FrontendStatus: {
                                    State: {
                                        state: 'WatchingLiveTV'
                                    }
                                }
                            }
                        })
                })
                it('68228 should send GUIDE action', async function () {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.68228',
                        name: 'Guide'
                    }
                    await verifyActionDirective(this.test['frontend'], Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'GUIDE',
                        response: true
                    }], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
            })
            context('Not WatchingLiveTV', function () {
                beforeEach(function () {
                    const frontend = this.currentTest['frontend']
                    const feNock = createFrontendNock(frontend.hostname())
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
                })
                it('69247 should send TV Recording Playback action', async function () {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.69247',
                        name: 'DVR'
                    }
                    await verifyActionDirective(this.test['frontend'], Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'TV Recording Playback',
                        response: true
                    }], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('68228 should send Program Guide action', async function () {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.68228',
                        name: 'Guide'
                    }
                    await verifyActionDirective(this.test['frontend'], Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'Program Guide',
                        response: true
                    }], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('33122 should send Main Menu action', async function () {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.33122',
                        name: 'Home'
                    }
                    await verifyActionDirective(this.test['frontend'], Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'Main Menu',
                        response: true
                    }], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('82117 should send INFO action', async function () {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.82117',
                        name: 'Info'
                    }
                    await verifyActionDirective(this.test['frontend'], Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'INFO',
                        response: true
                    }], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('84333 should send Live TV action', async function () {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.84333',
                        name: 'On Now'
                    }
                    await verifyActionDirective(this.test['frontend'], Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'Live TV',
                        response: true
                    }], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('06715 should send TOGGLEPIPMODE action', async function () {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.06715',
                        name: 'Picture in Picture'
                    }
                    await verifyActionDirective(this.test['frontend'], Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'TOGGLEPIPMODE',
                        response: true
                    }], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('52304 should send TV Recording Playback action', async function () {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.52304',
                        name: 'Recordings'
                    }
                    await verifyActionDirective(this.test['frontend'], Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'TV Recording Playback',
                        response: true
                    }], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('48625 should send Manage Recordings / Fix Conflicts action', async function () {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.48625',
                        name: 'Scheduled Recordings'
                    }
                    await verifyActionDirective(this.test['frontend'], Launcher.namespace, 'LaunchTarget', payload, [{
                        actionName: 'Manage Recordings / Fix Conflicts',
                        response: true
                    }], {
                        error: false,
                        payload: {},
                        stateChange: undefined
                    })
                })
                it('82307 should send Video Default action', async function () {
                    const payload: Launcher.Targets = {
                        identifier: 'amzn1.alexa-ask-target.shortcut.82307',
                        name: 'VOD'
                    }
                    await verifyActionDirective(this.test['frontend'], Launcher.namespace, 'LaunchTarget', payload, [{
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
    context('Alexa Shadow', function () {
        it('refreshCapability should emit true', async function () {
            await verifyRefreshCapability(sandbox, this.test['frontend'], false, Launcher.namespace, true)
        })
    })

})