import { PowerController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import Handler from '../src/MythPowerController';
import { createFrontendNock, createMockFrontend, getConnectionHandlerStub, getContextSandbox, getFrontend, getTopicHandlerMap, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';

interface Test {
    data: number
}
describe('MythPowerController', function () {
    beforeEach(async function () {
        const frontend = await createMockFrontend('power', this);
        createFrontendNock(frontend.hostname())
            .get('/GetStatus')
            .reply(200, {

            })
        const handler = new Handler(frontend)
        await handler.register()
    })
    context('MythtTV Events', function () {
        it('CLIENT_CONNECTED event should change state to ON', async function () {
            await verifyMythEventState(getContextSandbox(this),
                getFrontend(this), 'CLIENT_CONNECTED', {
                SENDER: ''
            }, PowerController.namespace, 'powerState', 'ON',
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this))
        })
        it('CLIENT_DISCONNECTED event should change state to OFF', async function () {
            await verifyMythEventState(getContextSandbox(this),
                getFrontend(this), 'CLIENT_DISCONNECTED', {
                SENDER: ''
            }, PowerController.namespace, 'powerState', 'OFF',
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this))
        })
    })
    context('Alexa Shadow', function () {
        context('refreshState', function () {
            it('should emit ON when success response', async function () {
                getFrontend(this).mythEventEmitter.emit('CLIENT_CONNECTED', {
                    SENDER: ''
                })
                await verifyRefreshState(getContextSandbox(this),
                    getFrontend(this), PowerController.namespace, 'powerState', 'ON',
                    getConnectionHandlerStub(this),
                    getTopicHandlerMap(this))
            })
            it('should emit OFF when failed response', async function () {
                getFrontend(this).mythEventEmitter.emit('CLIENT_DISCONNECTED', {
                    SENDER: ''
                })
                await verifyRefreshState(getContextSandbox(this),
                    getFrontend(this), PowerController.namespace, 'powerState', 'OFF',
                    getConnectionHandlerStub(this),
                    getTopicHandlerMap(this))
            })
        })
        it('refreshCapability should emit powerState', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, PowerController.namespace, ['powerState'])
        })
    })
})