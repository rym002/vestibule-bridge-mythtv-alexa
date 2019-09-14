import { PlaybackController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythPlaybackController';
import { createMockFrontend, verifyActionDirective, verifyRefreshCapability } from './MockHelper';


describe('MythPlaybackController', function () {
    const sandbox = createSandbox()
    beforeEach(async function () {
        const frontend = await createMockFrontend('playback');
        new Handler(frontend)
        this.currentTest['frontend'] = frontend
    })
    afterEach(function () {
        sandbox.restore()
    })
    context('directives', function () {
        it('FastForward should send SEEKFFWD action', async function () {
            await verifyActionDirective(this.test['frontend'], PlaybackController.namespace, 'FastForward', {}, [{
                actionName: 'SEEKFFWD',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('Rewind should send SEEKRWND action', async function () {
            await verifyActionDirective(this.test['frontend'], PlaybackController.namespace, 'Rewind', {}, [{
                actionName: 'SEEKRWND',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('Next should send SKIPCOMMERCIAL action', async function () {
            await verifyActionDirective(this.test['frontend'], PlaybackController.namespace, 'Next', {}, [{
                actionName: 'SKIPCOMMERCIAL',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('Pause should send PAUSE action', async function () {
            await verifyActionDirective(this.test['frontend'], PlaybackController.namespace, 'Pause', {}, [{
                actionName: 'PAUSE',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('Play should send PLAY action', async function () {
            await verifyActionDirective(this.test['frontend'], PlaybackController.namespace, 'Play', {}, [{
                actionName: 'PLAY',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('Previous should send SKIPCOMMBACK action', async function () {
            await verifyActionDirective(this.test['frontend'], PlaybackController.namespace, 'Previous', {}, [{
                actionName: 'SKIPCOMMBACK',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('StartOver should send JUMPSTART action', async function () {
            await verifyActionDirective(this.test['frontend'], PlaybackController.namespace, 'StartOver', {}, [{
                actionName: 'JUMPSTART',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
        it('Stop should send STOPPLAYBACK action', async function () {
            await verifyActionDirective(this.test['frontend'], PlaybackController.namespace, 'Stop', {}, [{
                actionName: 'STOPPLAYBACK',
                response: true
            }], {
                error: false,
                payload: {},
                stateChange: undefined
            })
        })
    })
    context('Alexa Shadow', function () {
        it('refreshCapability should emit All Operations', async function () {
            await verifyRefreshCapability(sandbox, this.test['frontend'], false, PlaybackController.namespace, ['FastForward', 'Rewind', 'Next', 'Pause', 'Play', 'Previous', 'StartOver', 'Stop'])
        })
    })

})