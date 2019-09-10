import { EndpointHealth } from '@vestibule-link/alexa-video-skill-types';
import { expect } from 'chai';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythEndpointHealth';
import { createFrontendNock, createMockFrontend, MockMythAlexaEventFrontend, toBool, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';


describe('MythEndpointHealth',()=>{
    const sandbox = createSandbox()
    let frontend: MockMythAlexaEventFrontend
    let handler: Handler
    before(async () => {
        frontend = await createMockFrontend('endpointhealth');
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
        it('CLIENT_CONNECTED event should change state to OK', async () => {
            await verifyMythEventState(sandbox, frontend, 'CLIENT_CONNECTED', {},EndpointHealth.namespace, 'connectivity', 'OK')
        })
        it('CLIENT_DISCONNECTED event should change state to UNREACHABLE', async () => {
            await verifyMythEventState(sandbox, frontend, 'CLIENT_DISCONNECTED', {},EndpointHealth.namespace, 'connectivity', 'UNREACHABLE')
        })
    })
    context('Alexa Shadow', () => {
        afterEach(() => {
            sandbox.restore()
            frontend.resetDeltaId()
        })
        context('refreshState', () => {
            it('should emit OK when success response', async () => {
                const feNock = createFrontendNock('endpointhealth')
                    .post('/SendAction')
                    .query({
                        Action: 'FAKE'
                    }).reply(200, () => {
                        return toBool(true);
                    })
                await verifyRefreshState(sandbox, frontend, EndpointHealth.namespace, 'connectivity', 'OK')
                expect(feNock.isDone()).to.be.true

            })
            it('should emit UNREACHABLE when failed response',async ()=>{
                await verifyRefreshState(sandbox, frontend, EndpointHealth.namespace, 'connectivity', 'UNREACHABLE')
            })
        })
        it('refreshCapability should emit powerState', async () => {
            await verifyRefreshCapability(sandbox, frontend, false, EndpointHealth.namespace, ['connectivity'])
        })
    })
})