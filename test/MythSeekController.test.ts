import { SeekController } from '@vestibule-link/alexa-video-skill-types';
import { expect } from 'chai';
import 'mocha';
import { createSandbox } from 'sinon';
import Handler from '../src/MythSeekController';
import { createBackendNock, createFrontendNock, createMockFrontend, MockMythAlexaEventFrontend, toBool, verifyActionDirective, verifyRefreshCapability } from './MockHelper';


describe('MythSeekController', () => {
    const sandbox = createSandbox()
    beforeEach(async function () {
        const frontend = await createMockFrontend('seek');
        new Handler(frontend)
        this.currentTest['frontend'] = frontend;
    })
    afterEach(function () {
        sandbox.restore()
    })
    context('directives', () => {
        it('should AdjustSeekPosition')
    })
    context('Alexa Shadow', () => {
        beforeEach(function () {

        })
        it('should parse', function () {
            const dateParser = new RegExp('^\\d{4}-[01]\\d-[0-3]\\d(?:T[0-2]\\d(?::[0-5]\\d){2}Z)?$')
            const r = dateParser.test('2019-04-01T02:09:09Z')
            const s = dateParser.test('2019-03-31')
            const numberParser = new RegExp('^\\d+(?:\.\\d+)?$')
            const t = numberParser.test('12334.123')
            const d = new Date('2019-03-31')
            const parsed = JSON.parse('{"x":["10","200"]}', (key, value: any) => {
                if (/^\d+$/.test(value)) {
                    return Number(value)
                }
                if (key == "d") {
                    return value.map(arrayVal => {
                        if (typeof arrayVal === 'number') {
                            return arrayVal + ''
                        }
                        return arrayVal
                    })
                }
                return value
            })
            console.log('d')
        })
        it('refreshCapability should emit true if enabled NetworkControlEnabled is 1', async function () {
            const hostname = this.test['frontend'].hostname()
            const mythNock = createBackendNock('Myth')
                .get('/GetSetting').query({
                    Key: 'NetworkControlEnabled',
                    HostName: hostname
                }).reply(200, {
                    String: '1'
                }).get('/GetSetting').query({
                    Key: 'NetworkControlPort',
                    HostName: hostname,
                    Default: '6546'
                }).reply(200, {
                    String: '6546'
                })
            await verifyRefreshCapability(sandbox, this.test['frontend'], false, SeekController.namespace, true)
        })
    })
})