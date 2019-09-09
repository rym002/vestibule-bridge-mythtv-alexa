import { PlaybackController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythPlaybackController';
import { createMockFrontend, MockMythAlexaEventFrontend, verifyActionDirective, verifyRefreshCapability } from './MockHelper';


describe('MythPlaybackController', () => {
    const sandbox = createSandbox()
    let frontend: MockMythAlexaEventFrontend
    let handler: Handler
    before(async () => {
        frontend = await createMockFrontend('playback');
        handler = new Handler(frontend)
    })
    afterEach(() => {
        sandbox.restore()
        frontend.resetDeltaId()
    })
    context('directives', () => {
        it('FastForward should send SEEKFFWD action', async () => {
            await verifyActionDirective(sandbox, frontend, PlaybackController.namespace, 'FastForward', {}, [{
                actionName: 'SEEKFFWD',
                response: true
            }], {
                    error: false,
                    payload: {},
                    stateChange:undefined
                })
        })
        it('Rewind should send SEEKRWND action', async () => {
            await verifyActionDirective(sandbox, frontend, PlaybackController.namespace, 'Rewind', {}, [{
                actionName: 'SEEKRWND',
                response: true
            }], {
                    error: false,
                    payload: {},
                    stateChange:undefined
                })
        })
        it('Next should send SKIPCOMMERCIAL action', async () => {
            await verifyActionDirective(sandbox, frontend, PlaybackController.namespace, 'Next', {}, [{
                actionName: 'SKIPCOMMERCIAL',
                response: true
            }], {
                    error: false,
                    payload: {},
                    stateChange:undefined
                })
        })
        it('Pause should send PAUSE action', async () => {
            await verifyActionDirective(sandbox, frontend, PlaybackController.namespace, 'Pause', {}, [{
                actionName: 'PAUSE',
                response: true
            }], {
                    error: false,
                    payload: {},
                    stateChange:undefined
                })
        })
        it('Play should send PLAY action', async () => {
            await verifyActionDirective(sandbox, frontend, PlaybackController.namespace, 'Play', {}, [{
                actionName: 'PLAY',
                response: true
            }], {
                    error: false,
                    payload: {},
                    stateChange:undefined
                })
        })
        it('Previous should send SKIPCOMMBACK action', async () => {
            await verifyActionDirective(sandbox, frontend, PlaybackController.namespace, 'Previous', {}, [{
                actionName: 'SKIPCOMMBACK',
                response: true
            }], {
                    error: false,
                    payload: {},
                    stateChange:undefined
                })
        })
        it('StartOver should send JUMPSTART action', async () => {
            await verifyActionDirective(sandbox, frontend, PlaybackController.namespace, 'StartOver', {}, [{
                actionName: 'JUMPSTART',
                response: true
            }], {
                    error: false,
                    payload: {},
                    stateChange:undefined
                })
        })
        it('Stop should send STOPPLAYBACK action', async () => {
            await verifyActionDirective(sandbox, frontend, PlaybackController.namespace, 'Stop', {}, [{
                actionName: 'STOPPLAYBACK',
                response: true
            }], {
                    error: false,
                    payload: {},
                    stateChange:undefined
                })
        })
    })
    context('Alexa Shadow', () => {
        it('refreshCapability should emit All Operations', async () => {
            await verifyRefreshCapability(sandbox, frontend, false, PlaybackController.namespace, handler.supported)
        })
    })

})