import { WakeOnLANController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import * as nodeArp from 'node-arp';
import { assert, createSandbox, SinonStub } from 'sinon';
import Handler from '../src/MythWol';
import { createMockFrontend, verifyRefreshCapability } from './MockHelper';
describe('MythWol', function () {
    const sandbox = createSandbox()
    let getMACStub: SinonStub
    before(async function () {
        getMACStub = sandbox.stub(nodeArp, 'getMAC')
    })
    beforeEach(async function () {
        const frontend = await createMockFrontend('remoteVideo');
        const handler = new Handler(frontend)
        const checkNodeStub = sandbox.stub(handler, 'checkNodeArp')
        this.currentTest['frontend'] = frontend
        this.currentTest['checkNodeStub'] = checkNodeStub
    })
    after(function () {
        sandbox.restore()
    })
    context('Alexa Shadow', function () {
        context('refreshCapability', function () {
            beforeEach(function () {
                const checkNodeStub: SinonStub<[string], Promise<void>> = this.currentTest['checkNodeStub']
                checkNodeStub.callsFake((command) => {
                    return Promise.resolve()
                })
            })
            it('should emit capability if the MAC is found', async function () {
                const macAddress = '12:34:56:78:90:AB'
                getMACStub.callsFake((host, cb) => {
                    cb(undefined, macAddress)
                })
                await verifyRefreshCapability(sandbox, this.test['frontend'], true, WakeOnLANController.namespace, [macAddress])
                assert.calledOnce(getMACStub)
            })
            it('should not emit capability when MAC is not found', async function () {
                getMACStub.callsFake((host, cb) => {
                    cb(undefined, undefined)
                })
                await verifyRefreshCapability(sandbox, this.test['frontend'], true, WakeOnLANController.namespace, undefined)
            })
            it('should not emit capability when arp error', async function () {
                getMACStub.callsFake((host, cb) => {
                    cb(new Error('Fake Error'), undefined)
                })
                await verifyRefreshCapability(sandbox, this.test['frontend'], true, WakeOnLANController.namespace, undefined)
            })
            it('should not emit capability if any command is missing',async function(){
                const checkNodeStub: SinonStub<[string], Promise<void>> = this.test['checkNodeStub']
                checkNodeStub.callsFake((command) => {
                    return Promise.reject(new Error('Command Error ' + command))
                })
                const macAddress = '12:34:56:78:90:AB'
                getMACStub.callsFake((host, cb) => {
                    cb(undefined, macAddress)
                })
                await verifyRefreshCapability(sandbox, this.test['frontend'], true, WakeOnLANController.namespace, undefined)
                assert.calledTwice(checkNodeStub)
            })
        })
    })

})