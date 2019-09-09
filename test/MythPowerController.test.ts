import { PowerController } from '@vestibule-link/alexa-video-skill-types';
import { expect } from 'chai';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythPowerController';
import { createFrontendNock, createMockFrontend, MockMythAlexaEventFrontend, toBool, verifyRefreshCapability, verifyRefreshState, verifyState } from './MockHelper';


describe('MythPowerController', () => {
    const sandbox = createSandbox()
    let frontend: MockMythAlexaEventFrontend
    let handler: Handler
    before(async () => {
        frontend = await createMockFrontend('power');
        handler = new Handler(frontend)
    })
    afterEach(() => {
        sandbox.restore()
        frontend.resetDeltaId()
    })
    context('MythtTV Events', () => {
        afterEach(() => {
            sandbox.restore()
            frontend.resetDeltaId()
        })
        it('CLIENT_CONNECTED event should change state to ON', async () => {
            await verifyState(sandbox, frontend, PowerController.namespace, 'powerState', 'ON', () => {
                frontend.mythEventEmitter.emit('CLIENT_CONNECTED', {})
            })
        })
        it('CLIENT_DISCONNECTED event should change state to OFF', async () => {
            await verifyState(sandbox, frontend, PowerController.namespace, 'powerState', 'OFF', () => {
                frontend.mythEventEmitter.emit('CLIENT_DISCONNECTED', {})
            })
        })
    })
    context('Alexa Shadow', () => {
        afterEach(() => {
            sandbox.restore()
            frontend.resetDeltaId()
        })
        context('refreshState', () => {
            it('should emit ON when success response', async () => {
                const feNock = createFrontendNock('power')
                    .post('/SendAction')
                    .query({
                        Action: 'FAKE'
                    }).reply(200, () => {
                        return toBool(true);
                    })
                await verifyRefreshState(sandbox, frontend, PowerController.namespace, 'powerState', 'ON')
                expect(feNock.isDone()).to.be.true

            })
            it('should emit OFF when failed response',async ()=>{
                await verifyRefreshState(sandbox, frontend, PowerController.namespace, 'powerState', 'OFF')
            })
        })
        it('refreshCapability should emit powerState', async () => {
            await verifyRefreshCapability(sandbox, frontend, false, PowerController.namespace, ['powerState'])
        })
    })
})