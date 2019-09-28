import { EndpointHealth } from '@vestibule-link/alexa-video-skill-types';
import { expect } from 'chai';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythEndpointHealth';
import { createFrontendNock, createMockFrontend, toBool, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';


describe('MythEndpointHealth', function () {
    const sandbox = createSandbox()
    this.beforeEach(async function () {
        const frontend = await createMockFrontend('endpointhealth');
        new Handler(frontend)
        this.currentTest['frontend'] = frontend
    })
    afterEach(function () {
        sandbox.restore()
    })
    context('MythtTV Events', function () {
        it('CLIENT_CONNECTED event should change state to OK', async function () {
            await verifyMythEventState(this.test['frontend'], 'CLIENT_CONNECTED', {}, EndpointHealth.namespace, 'connectivity', 'OK')
        })
        it('CLIENT_DISCONNECTED event should change state to UNREACHABLE', async function () {
            await verifyMythEventState(this.test['frontend'], 'CLIENT_DISCONNECTED', {}, EndpointHealth.namespace, 'connectivity', 'UNREACHABLE')
        })
    })
    context('Alexa Shadow', function () {
        context('refreshState', function () {
            it('should emit OK when success response', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
                    .post('/SendAction')
                    .query({
                        Action: 'FAKE'
                    }).reply(200, toBool(true))
                await verifyRefreshState(this.test['frontend'], EndpointHealth.namespace, 'connectivity', 'OK')
                expect(feNock.isDone()).to.be.true

            })
            it('should emit UNREACHABLE when failed response', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
                    .post('/SendAction')
                    .query({
                        Action: 'FAKE'
                    }).replyWithError('Failed')
                await verifyRefreshState(this.test['frontend'], EndpointHealth.namespace, 'connectivity', 'UNREACHABLE')
            })
        })
        it('refreshCapability should emit powerState', async function () {
            await verifyRefreshCapability(sandbox, this.test['frontend'], false, EndpointHealth.namespace, ['connectivity'])
        })
    })
})