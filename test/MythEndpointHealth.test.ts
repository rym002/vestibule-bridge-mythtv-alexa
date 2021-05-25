import { EndpointHealth } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import Handler from '../src/MythEndpointHealth';
import { createMockFrontend, getConnectionHandlerStub, getContextSandbox, getFrontend, getTopicHandlerMap, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';


describe('MythEndpointHealth', function () {
    this.beforeEach(async function () {
        const frontend = await createMockFrontend('endpointhealth', this);
        frontend.mythEventEmitter.emit('CLIENT_CONNECTED', {
            SENDER: ''
        })
        const handler = new Handler(frontend)
        await handler.register()
    })
    context('MythtTV Events', function () {
        it('CLIENT_CONNECTED event should change state to OK', async function () {
            await verifyMythEventState(getContextSandbox(this),
                getFrontend(this), 'CLIENT_CONNECTED', {
                SENDER: ''
            }, EndpointHealth.namespace, 'connectivity', { value: 'OK' },
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this))
        })
        it('CLIENT_DISCONNECTED event should change state to UNREACHABLE', async function () {
            await verifyMythEventState(getContextSandbox(this),
                getFrontend(this), 'CLIENT_DISCONNECTED', {
                SENDER: ''
            }, EndpointHealth.namespace, 'connectivity', { value: 'UNREACHABLE' },
                getConnectionHandlerStub(this),
                getTopicHandlerMap(this))
        })
    })
    context('Alexa Shadow', function () {
        context('refreshState', function () {
            it('should emit OK when success response', async function () {
                getFrontend(this).mythEventEmitter.emit('CLIENT_CONNECTED', {
                    SENDER: ''
                })
                await verifyRefreshState(getContextSandbox(this),
                    getFrontend(this), EndpointHealth.namespace, 'connectivity', { value: 'OK' },
                    getConnectionHandlerStub(this),
                    getTopicHandlerMap(this))
            })
            it('should emit UNREACHABLE when failed response', async function () {
                getFrontend(this).mythEventEmitter.emit('CLIENT_DISCONNECTED', {
                    SENDER: ''
                })
                await verifyRefreshState(getContextSandbox(this),
                    getFrontend(this), EndpointHealth.namespace, 'connectivity', { value: 'UNREACHABLE' },
                    getConnectionHandlerStub(this),
                    getTopicHandlerMap(this))
            })
        })
        it('refreshCapability should emit powerState', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, EndpointHealth.namespace, ['connectivity'])
        })
    })
})