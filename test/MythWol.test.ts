import { WakeOnLANController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import * as nodeArp from 'node-arp';
import { assert, createSandbox, SinonStub } from 'sinon';
import Handler from '../src/MythWol';
import { createMockFrontend, MockMythAlexaEventFrontend, verifyRefreshCapability } from './MockHelper';

describe('MythWol', () => {
    const sandbox = createSandbox()
    let frontend: MockMythAlexaEventFrontend
    let handler: Handler
    let getMACStub: SinonStub
    before(async () => {
        getMACStub = sandbox.stub(nodeArp, 'getMAC')
        frontend = await createMockFrontend('wol');
        handler = new Handler(frontend)
    })
    context('Alexa Shadow', () => {
        context('refreshCapability', () => {
            afterEach(() => {
                sandbox.restore()
                frontend.resetDeltaId()
            })
            it('should emit capability if the MAC is found', async () => {
                const macAddress = '12:34:56:78:90:AB'
                getMACStub.callsFake((host, cb) => {
                    cb(undefined, macAddress)
                })
                await verifyRefreshCapability(sandbox, frontend, true, WakeOnLANController.namespace, [macAddress])
                assert.calledOnce(getMACStub)
            })
            it('should not emit capability when MAC is not found', async () => {
                getMACStub.callsFake((host, cb) => {
                    cb(undefined, undefined)
                })
                await verifyRefreshCapability(sandbox, frontend, true, WakeOnLANController.namespace, undefined)
            })
            it('should not emit capability when arp error', async () => {
                getMACStub.callsFake((host, cb) => {
                    cb(new Error('Fake Error'), undefined)
                })
                await verifyRefreshCapability(sandbox, frontend, true, WakeOnLANController.namespace, undefined)
            })
        })
    })

})