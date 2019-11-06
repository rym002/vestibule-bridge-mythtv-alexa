import { WakeOnLANController } from '@vestibule-link/alexa-video-skill-types';
import 'mocha';
import * as nodeArp from 'node-arp';
import { assert, SinonStub } from 'sinon';
import Handler from '../src/MythWol';
import { createMockFrontend, verifyRefreshCapability, getFrontend, getContextSandbox, createContextSandbox, restoreSandbox } from './MockHelper';

describe('MythWol', function () {
    beforeEach(async function () {
        const sandbox = createContextSandbox(this)
        this.currentTest['getMACStub'] = sandbox.stub(nodeArp, 'getMAC')
        const frontend = await createMockFrontend('remoteVideo', this);
        const handler = new Handler(frontend)
        const checkNodeStub = sandbox.stub(handler, 'checkNodeArp')
        this.currentTest['checkNodeStub'] = checkNodeStub
    })
    afterEach(function () {
        restoreSandbox(this)
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
                this.test['getMACStub'].callsFake((host, cb) => {
                    cb(undefined, macAddress)
                })
                await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), true, WakeOnLANController.namespace, [macAddress])
                assert.calledOnce(this.test['getMACStub'])
            })
            it('should not emit capability when MAC is not found', async function () {
                this.test['getMACStub'].callsFake((host, cb) => {
                    cb(undefined, undefined)
                })
                await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), true, WakeOnLANController.namespace, undefined)
            })
            it('should not emit capability when arp error', async function () {
                this.test['getMACStub'].callsFake((host, cb) => {
                    cb(new Error('Fake Error'), undefined)
                })
                await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), true, WakeOnLANController.namespace, undefined)
            })
            it('should not emit capability if any command is missing', async function () {
                const checkNodeStub: SinonStub<[string], Promise<void>> = this.test['checkNodeStub']
                checkNodeStub.callsFake((command) => {
                    return Promise.reject(new Error('Command Error ' + command))
                })
                const macAddress = '12:34:56:78:90:AB'
                this.test['getMACStub'].callsFake((host, cb) => {
                    cb(undefined, macAddress)
                })
                await verifyRefreshCapability(getContextSandbox(this), getFrontend(this), true, WakeOnLANController.namespace, undefined)
                assert.calledTwice(checkNodeStub)
            })
        })
    })

})