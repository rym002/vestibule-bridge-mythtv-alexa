import { KeypadController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import Handler from '../src/MythKeypadController';
import { createContextSandbox, createMockFrontend, getContextSandbox, getFrontend, restoreSandbox, verifyActionDirective, verifyRefreshCapability } from './MockHelper';


describe('MythKeypadController', function () {
    beforeEach(async function () {
        createContextSandbox(this)
        const frontend = await createMockFrontend('keypadController', this);
        new Handler(frontend)
    })
    afterEach(function () {
        restoreSandbox(this)
    })
    context('directives', function () {
        context('SendKeystroke', function () {
            it('UP should send UP action', async function () {
                const payload: KeypadController.SendKeystrokeRequest = {
                    keystroke: 'UP'
                }
                await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                    actionName: 'UP',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('DOWN should send DOWN action', async function () {
                const payload: KeypadController.SendKeystrokeRequest = {
                    keystroke: 'DOWN'
                }
                await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                    actionName: 'DOWN',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('LEFT should send LEFT action', async function () {
                const payload: KeypadController.SendKeystrokeRequest = {
                    keystroke: 'LEFT'
                }
                await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                    actionName: 'LEFT',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
            it('RIGHT should send RIGHT action', async function () {
                const payload: KeypadController.SendKeystrokeRequest = {
                    keystroke: 'RIGHT'
                }
                await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                    actionName: 'RIGHT',
                    response: true
                }], {
                    error: false,
                    payload: {},
                    stateChange: undefined
                })
            })
        })
        it('PAGE_UP should send PAGEUP action', async function () {
            const payload: KeypadController.SendKeystrokeRequest = {
                keystroke: 'PAGE_UP'
            }
            await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                actionName: 'PAGEUP',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('PAGE_DOWN should send PAGEDOWN action', async function () {
            const payload: KeypadController.SendKeystrokeRequest = {
                keystroke: 'PAGE_DOWN'
            }
            await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                actionName: 'PAGEDOWN',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('PAGE_LEFT should send PAGELEFT action', async function () {
            const payload: KeypadController.SendKeystrokeRequest = {
                keystroke: 'PAGE_LEFT'
            }
            await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                actionName: 'PAGELEFT',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('PAGE_RIGHT should send PAGERIGHT action', async function () {
            const payload: KeypadController.SendKeystrokeRequest = {
                keystroke: 'PAGE_RIGHT'
            }
            await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                actionName: 'PAGERIGHT',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('SELECT should send SELECT action', async function () {
            const payload: KeypadController.SendKeystrokeRequest = {
                keystroke: 'SELECT'
            }
            await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                actionName: 'SELECT',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('INFO should send INFO action', async function () {
            const payload: KeypadController.SendKeystrokeRequest = {
                keystroke: 'INFO'
            }
            await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                actionName: 'INFO',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('MORE should send DETAILS action', async function () {
            const payload: KeypadController.SendKeystrokeRequest = {
                keystroke: 'MORE'
            }
            await verifyActionDirective(getFrontend(this), KeypadController.namespace, 'SendKeystroke', payload, [{
                actionName: 'DETAILS',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
    })
    context('Alexa Shadow', function () {
        it('refreshCapability should emit true', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, KeypadController.namespace, ['UP', 'DOWN', 'LEFT', 'RIGHT', 'SELECT',
                'PAGE_UP', 'PAGE_DOWN', 'PAGE_LEFT', 'PAGE_RIGHT', 'INFO', 'MORE'])
        })
    })

})