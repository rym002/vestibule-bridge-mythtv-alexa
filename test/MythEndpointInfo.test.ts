import { EndpointInfo, generateEndpointId } from '@vestibule-link/iot-types';
import { expect } from 'chai';
import 'mocha';
import { getLocalEndpoint, MANUFACTURER_NAME } from '../src/Frontend';
import Handler from '../src/MythEndpointInfo';
import { createBackendNock, createContextSandbox, createMockFrontend, getFrontend, restoreSandbox } from './MockHelper';


describe('MythEndpointInfo', function () {
    beforeEach(async function () {
        createContextSandbox(this)
        const frontend = await createMockFrontend('endpointinfo',this);
        new Handler(frontend)
    })
    afterEach(function () {
        restoreSandbox(this)
    })
    context('Alexa Shadow', function () {
        it('should refreshInfo', async function () {
            const frontend = getFrontend(this)
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