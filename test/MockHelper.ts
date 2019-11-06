import { Directive } from "@vestibule-link/alexa-video-skill-types";
import { providersEmitter, responseRouter } from "@vestibule-link/bridge-assistant";
import { AlexaEndpointEmitter } from "@vestibule-link/bridge-assistant-alexa";
import { registerAssistant } from "@vestibule-link/bridge-assistant-alexa/dist/endpoint";
import { mergeObject } from "@vestibule-link/bridge-mythtv";
import { CachingEventFrontend } from "@vestibule-link/bridge-mythtv/dist/frontends";
import { DirectiveResponse, EndpointCapability, EndpointState, ResponseMessage, SubType } from "@vestibule-link/iot-types";
import { expect } from 'chai';
import { EventEmitter } from "events";
import { memoize, MemoizedFunction, keys } from "lodash";
import { MythSenderEventEmitter } from "mythtv-event-emitter";
import { EventMapping } from "mythtv-event-emitter/dist/messages";
import { frontend } from "mythtv-services-api";
import { assert, match, SinonSandbox, createSandbox } from "sinon";
import { AlexaEventFrontend, MANUFACTURER_NAME, MythAlexaEventFrontend } from "../src/Frontend";
import nock = require("nock");
export interface MockMythAlexaEventFrontend extends MythAlexaEventFrontend {
    resetDeltaId(): void
}
class MockAlexaFrontend {
    readonly mythEventEmitter: MythSenderEventEmitter
    readonly alexaEmitter: AlexaEndpointEmitter
    readonly masterBackendEmitter: MythSenderEventEmitter
    private readonly memoizeEventDelta: MemoizedFunction
    eventDeltaId: () => symbol
    constructor(readonly fe: MythAlexaEventFrontend) {
        const memoizeEventDelta = memoize(() => {
            return Symbol();
        })
        this.eventDeltaId = memoizeEventDelta;
        this.memoizeEventDelta = memoizeEventDelta
        this.alexaEmitter = fe.alexaEmitter
        this.mythEventEmitter = fe.mythEventEmitter
        this.masterBackendEmitter = fe.masterBackendEmitter
    }
    private clearCache(funct: MemoizedFunction) {
        funct.cache.clear && funct.cache.clear();
    }
    resetDeltaId() {
        this.clearCache(this.memoizeEventDelta);
    }
}

export function createFrontendNock(hostname: string) {
    return nock('http://' + hostname + ':6547/Frontend')
}

export function createBackendNock(service: string) {
    return nock("http://localhost:6544/" + service)
}
export async function createMockFrontend(hostname: string, context: Mocha.Context): Promise<MockMythAlexaEventFrontend> {
    hostname += Math.random()
    const mythNock = createBackendNock('Myth')
        .get('/GetSetting').query({
            Key: 'FrontendStatusPort',
            HostName: hostname,
            Default: '6547'
        }).reply(200, {
            String: '6547'
        });
    registerAssistant();
    const fe = await frontend(hostname);
    const alexaEmitter = <AlexaEndpointEmitter>providersEmitter.getEndpointEmitter('alexa', { provider: MANUFACTURER_NAME, host: fe.hostname() }, true)
    const mythFe = new CachingEventFrontend(fe, new EventEmitter(), new EventEmitter())
    const mergedMythFe = mergeObject(mythFe, fe);
    const alexaFe = new AlexaEventFrontend(alexaEmitter, mergedMythFe);
    const mergedFe = mergeObject(alexaFe, mergedMythFe);
    const mockFe = new MockAlexaFrontend(mergedFe)
    const mergedMockFe = mergeObject(mockFe, mergedFe);
    context.currentTest['frontend'] = mergedMockFe
    return mergedMockFe;
}

export async function verifyRefreshCapability<NS extends keyof EndpointCapability>(sandbox: SinonSandbox, frontend: MythAlexaEventFrontend, isAsync: boolean, expectedNamespace: NS, expectedCapability: SubType<EndpointCapability, NS>) {
    const emitterPromise = new Promise((resolve, reject) => {
        frontend.alexaEmitter.once('capability', (namespace, value, deltaId) => {
            try {
                expect(namespace).to.equal(expectedNamespace)
                expect(deltaId).to.equal(frontend.eventDeltaId())
                expect(value).eql(expectedCapability)
                resolve()
            } catch (err) {
                reject(err)
            }
        })
    })

    const watchDeltaUpdateSpy = sandbox.spy(frontend.alexaEmitter, 'watchDeltaUpdate')
    frontend.alexaEmitter.emit('refreshCapability', frontend.eventDeltaId());
    if (isAsync) {
        assert.calledOnce(watchDeltaUpdateSpy)
        assert.calledWith(watchDeltaUpdateSpy, match.any, frontend.eventDeltaId())
    }
    await emitterPromise;
}

export async function verifyState<NS extends keyof EndpointState, N extends keyof EndpointState[NS]>(
    frontend: MythAlexaEventFrontend, expectedNamespace: NS, expectedName: N, expectedState: SubType<SubType<EndpointState, NS>, N>,
    triggerFunction: Function) {
    const emitterPromise = new Promise((resolve, reject) => {
        frontend.alexaEmitter.once('state', (namespace, name, value, deltaId) => {
            try {
                expect(namespace).to.equal(expectedNamespace)
                expect(name).to.equal(expectedName)
                // expect(deltaId).to.equal(frontend.eventDeltaId())
                expect(value).eql(expectedState)
                resolve()
            } catch (err) {
                reject(err)
            }
        })
    })
    triggerFunction()
    await emitterPromise;
}

export async function verifyRefreshState<NS extends keyof EndpointState, N extends keyof EndpointState[NS]>(
    frontend: MythAlexaEventFrontend, expectedNamespace: NS, expectedName: N, expectedState: SubType<SubType<EndpointState, NS>, N>) {
    await verifyState(frontend, expectedNamespace, expectedName, expectedState, () => {
        frontend.alexaEmitter.emit('refreshState', frontend.eventDeltaId())
    })
}

export async function verifyMythEventState<NS extends keyof EndpointState, N extends keyof EndpointState[NS], T extends keyof EventMapping, P extends EventMapping[T]>(
    frontend: MythAlexaEventFrontend, eventType: T, eventMessage: P,
    expectedNamespace: NS, expectedName: N, expectedState: SubType<SubType<EndpointState, NS>, N>, emitBackend?: boolean) {
    await verifyState(frontend, expectedNamespace, expectedName, expectedState, () => {
        if (emitBackend) {
            frontend.masterBackendEmitter.emit(eventType, eventMessage)
        } else {
            frontend.mythEventEmitter.emit(eventType, eventMessage)
        }
    })
}
export function toBool(data: boolean) {
    return {
        bool: data + ''
    }
}

export async function verifyActionDirective<NS extends Directive.Namespaces, N extends keyof Directive.NamedMessage[NS], DN extends keyof DirectiveResponse[NS]>(
    frontend: MythAlexaEventFrontend, namespace: NS, name: N,
    requestMessage: Directive.NamedMessage[NS][N] extends { payload: any } ? Directive.NamedMessage[NS][N]['payload'] : never,
    expectedMythtvActions: ActionMessage[],
    expectedResponse: ResponseMessage<DirectiveResponse[NS][DN] extends { payload: any } ? DirectiveResponse[NS][DN]['payload'] : never>,
    stateChange?: EndpointState) {
    const messageId = Symbol();
    let frontendNock = createFrontendNock(frontend.hostname())
    expectedMythtvActions.forEach(mythAction => {
        frontendNock = frontendNock.post('/SendAction')
            .query({
                Action: mythAction.actionName
            }).reply(200, toBool(mythAction.response))
    })
    if (stateChange) {
        const stateEmitter = <EventEmitter>frontend.alexaEmitter.alexaStateEmitter
        keys(stateChange).forEach((key) => {
            stateEmitter.once('newListener', (event, listener) => {
                if (event == key) {
                    process.nextTick(() => {
                        keys(stateChange[key]).forEach((stateKey) => {
                            frontend.alexaEmitter.alexaStateEmitter.emit(<never>key, <never>stateKey, <never>stateChange[key][stateKey])
                        })
                    })
                }
            })
        })
    }
    const responsePromise = new Promise((resolve, reject) => {
        responseRouter.once(messageId, (response) => {
            try {
                expect(response).to.eql(expectedResponse)
                expect(frontendNock.isDone()).to.be.true
                resolve()
            } catch (err) {
                reject(err)
            }
        })
    })
    frontend.alexaEmitter.emit('directive', [namespace, <string>name], requestMessage, messageId)
    await responsePromise;
}

export interface ActionMessage {
    actionName: string
    response: boolean
}


export function getFrontend(context: Mocha.Context): MockMythAlexaEventFrontend {
    return context.currentTest
        ? context.currentTest['frontend']
        : context.test['frontend']
}

export function createContextSandbox(context: Mocha.Context): SinonSandbox {
    const sandbox = createSandbox({
        useFakeTimers: true
    })
    context.currentTest['sandbox'] = sandbox
    return sandbox
}

export function restoreSandbox(context: Mocha.Context) {
    context.currentTest['sandbox'].restore()
}

export function getContextSandbox(context: Mocha.Context): SinonSandbox {
    return context.test['sandbox']
}