import { EndpointHealth } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythEndpointHealth';
import { createMockFrontend, verifyMythEventState, verifyRefreshCapability, verifyRefreshState, createContextSandbox, restoreSandbox, getContextSandbox, getFrontend } from './MockHelper';


describe('MythEndpointHealth', function () {
    this.beforeEach(async function () {
        createContextSandbox(this)
        const frontend = await createMockFrontend('endpointhealth', this);
        frontend.mythEventEmitter.emit('CLIENT_CONNECTED', {
            SENDER: ''
        })
        new Handler(frontend)
    })
    afterEach(function () {
        restoreSandbox(this)
    })
    context('MythtTV Events', function () {
        it('CLIENT_CONNECTED event should change state to OK', async function () {
            await verifyMythEventState(getFrontend(this), 'CLIENT_CONNECTED', {
                SENDER: ''
            }, EndpointHealth.namespace, 'connectivity', 'OK')
        })
        it('CLIENT_DISCONNECTED event should change state to UNREACHABLE', async function () {
            await verifyMythEventState(getFrontend(this), 'CLIENT_DISCONNECTED', {
                SENDER: ''
            }, EndpointHealth.namespace, 'connectivity', 'UNREACHABLE')
        })
    })
    context('Alexa Shadow', function () {
        context('refreshState', function () {
            it('should emit OK when success response', async function () {
                getFrontend(this).mythEventEmitter.emit('CLIENT_CONNECTED', {
                    SENDER: ''
                })
                await verifyRefreshState(getFrontend(this), EndpointHealth.namespace, 'connectivity', 'OK')
            })
            it('should emit UNREACHABLE when failed response', async function () {
                getFrontend(this).mythEventEmitter.emit('CLIENT_DISCONNECTED', {
                    SENDER: ''
                })
                await verifyRefreshState(getFrontend(this), EndpointHealth.namespace, 'connectivity', 'UNREACHABLE')
            })
        })
        it('refreshCapability should emit powerState', async function () {
            await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), false, EndpointHealth.namespace, ['connectivity'])
        })
    })
})