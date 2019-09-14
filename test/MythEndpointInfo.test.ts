import { EndpointInfo, generateEndpointId } from '@vestibule-link/iot-types';
import { expect } from 'chai';
import 'mocha';
import { createSandbox } from 'sinon';
import { getLocalEndpoint, MANUFACTURER_NAME } from '../src/Frontend';
import Handler from '../src/MythEndpointInfo';
import { createBackendNock, createMockFrontend } from './MockHelper';


describe('MythEndpointInfo', function () {
    const sandbox = createSandbox()
    beforeEach(async function () {
        const frontend = await createMockFrontend('endpointinfo');
        new Handler(frontend)
        this.currentTest['frontend'] = frontend
    })
    afterEach(function () {
        sandbox.restore()
    })
    context('Alexa Shadow', function () {
        it('should refreshInfo', async function () {
            const frontend = this.test['frontend']
            const alexaDeviceName = frontend.hostname() + ' Alexa'
            const frontendNock = createBackendNock('Myth')
                .get('/GetSetting').query({
                    Key: 'AlexaFriendlyName',
                    HostName: frontend.hostname(),
                    Default: frontend.hostname()
                }).reply(200, function () {
                    return {
                        String: alexaDeviceName
                    };
                })
            const expectedEndpointInfo: EndpointInfo = {
                displayCategories: ['TV'],
                manufacturerName: MANUFACTURER_NAME,
                friendlyName: alexaDeviceName,
                description: MANUFACTURER_NAME + ' Frontend ' + frontend.hostname(),
                endpointId: generateEndpointId(getLocalEndpoint(frontend))
            }
            const emitterPromise = new Promise((resolve, reject) => {
                frontend.alexaEmitter.once('info', (endpointInfo, deltaId) => {
                    try {
                        expect(deltaId).to.equal(frontend.eventDeltaId())
                        expect(endpointInfo).eql(expectedEndpointInfo)
                        expect(frontendNock.isDone()).to.be.true
                        resolve()
                    } catch (err) {
                        reject(err)
                    }
                })
            })
            frontend.alexaEmitter.emit('refreshInfo', frontend.eventDeltaId())
            await emitterPromise;
        })
    })

})