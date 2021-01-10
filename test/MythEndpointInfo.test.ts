import { EndpointInfo } from '@vestibule-link/iot-types';
import 'mocha';
import { getEndpointName, MANUFACTURER_NAME } from '../src/Frontend';
import Handler from '../src/MythEndpointInfo';
import { createBackendNock, createMockFrontend, getContextSandbox, getFrontend } from './MockHelper';


describe('MythEndpointInfo', function () {
    beforeEach(async function () {
        const frontend = await createMockFrontend('endpointinfo', this);
        const handler = new Handler(frontend)
        await handler.register()
    })
    context('Alexa Shadow', function () {
        it('should refreshInfo', async function () {
            const frontend = getFrontend(this)
            const sandbox = getContextSandbox(this)
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
                endpointId: getEndpointName(frontend)
            }
            const updateInfoSpy = sandbox.spy(frontend.alexaConnector,'updateInfo')
            frontend.alexaConnector.refreshInfo(frontend.eventDeltaId())
            await frontend.alexaConnector.completeDeltaSettings(frontend.eventDeltaId())
            sandbox.assert.calledWith(updateInfoSpy,expectedEndpointInfo,frontend.eventDeltaId())
        })
    })

})