import { PowerController } from '@vestibule-link/alexa-video-skill-types';
import { expect } from 'chai';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythPowerController';
import { createFrontendNock, createMockFrontend, toBool, verifyMythEventState, verifyRefreshCapability, verifyRefreshState } from './MockHelper';

interface Test {
    data: number
}
describe('MythPowerController', function () {
    const sandbox = createSandbox()
    beforeEach(async function () {
        const frontend = await createMockFrontend('power');
        new Handler(frontend)
        this.currentTest['frontend'] = frontend
    })
    afterEach(function () {
        sandbox.restore()
    })
    context('MythtTV Events', function () {
        it('CLIENT_CONNECTED event should change state to ON', async function () {
            await verifyMythEventState(this.test['frontend'], 'CLIENT_CONNECTED', {}, PowerController.namespace, 'powerState', 'ON')
        })
        it('CLIENT_DISCONNECTED event should change state to OFF', async function () {
            await verifyMythEventState(this.test['frontend'], 'CLIENT_DISCONNECTED', {}, PowerController.namespace, 'powerState', 'OFF')
        })
    })
    context('Alexa Shadow', function () {
        context('refreshState', function () {
            it('should emit ON when success response', async function () {
                const feNock = createFrontendNock(this.test['frontend'].hostname())
                    .post('/SendAction')
                    .query({
                        Action: 'FAKE'
                    }).reply(200, function () {
                        return toBool(true);
                    })
                await verifyRefreshState(this.test['frontend'], PowerController.namespace, 'powerState', 'ON')
                expect(feNock.isDone()).to.be.true

            })
            it('should emit OFF when failed response', async function () {
                await verifyRefreshState(this.test['frontend'], PowerController.namespace, 'powerState', 'OFF')
            })
        })
        it('refreshCapability should emit powerState', async function () {
            await verifyRefreshCapability(sandbox,this.test['frontend'], false, PowerController.namespace, ['powerState'])
        })
    })
})