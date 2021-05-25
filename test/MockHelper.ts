import { Directive } from "@vestibule-link/alexa-video-skill-types";
import { AlexaEndpointConnector } from "@vestibule-link/bridge-assistant-alexa";
import { registerAssistant } from "@vestibule-link/bridge-assistant-alexa/dist/endpoint";
import * as iot from "@vestibule-link/bridge-gateway-aws/dist/iot";
import { mergeObject } from "@vestibule-link/bridge-mythtv";
import { CachingEventFrontend } from "@vestibule-link/bridge-mythtv/dist/frontends";
import { serviceProviderManager } from "@vestibule-link/bridge-service-provider";
import { DirectiveResponse, EndpointCapability, EndpointState, RequestMessage, ResponseMessage, SubType } from "@vestibule-link/iot-types";
import { mqtt } from 'aws-iot-device-sdk-v2';
import { expect } from 'chai';
import { EventEmitter } from "events";
import { keys, memoize, MemoizedFunction } from "lodash";
import * as moment from 'moment';
import { MythSenderEventEmitter } from "mythtv-event-emitter";
import { EventMapping } from "mythtv-event-emitter/dist/messages";
import { Frontend, frontend } from "mythtv-services-api";
import { createSandbox, match, SinonSandbox, SinonStubbedInstance, SinonStubbedMember, StubbableType } from "sinon";
import { AlexaEventFrontend, getEndpointName, MythAlexaEventFrontend } from "../src/Frontend";
import nock = require("nock");

const clientId = 'testClientId'

export interface MockMythAlexaEventFrontend extends MythAlexaEventFrontend {
    resetDeltaId(): void
}
class MockAlexaFrontend {
    readonly mythEventEmitter: MythSenderEventEmitter
    readonly alexaConnector: AlexaEndpointConnector
    readonly masterBackendEmitter: MythSenderEventEmitter
    private readonly memoizeEventDelta: MemoizedFunction
    eventDeltaId: () => symbol
    constructor(readonly fe: MythAlexaEventFrontend) {
        const memoizeEventDelta = memoize(() => {
            return Symbol();
        })
        this.eventDeltaId = memoizeEventDelta;
        this.memoizeEventDelta = memoizeEventDelta
        this.alexaConnector = fe.alexaConnector
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

const encoder = new TextEncoder()
async function emitTopic(topicHandlerMap: TopicHandlerMap, listenTopic: string, topic: string, req: any) {
    const topicHandler = topicHandlerMap[listenTopic]
    if (topicHandler) {
        await topicHandler(topic, encoder.encode(JSON.stringify(req)), false, mqtt.QoS.AtMostOnce, false)
    } else {
        throw new Error(`Topic Handler not found for ${listenTopic}`)
    }
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
    const fe = await frontend(hostname);
    const alexaConnector = await serviceProviderManager.getEndpointConnector('alexa', getEndpointName(fe), true)
    const mythFe = new CachingEventFrontend(fe, new EventEmitter(), new EventEmitter())
    const mergedMythFe = mergeObject(mythFe, fe);
    const alexaFe = new AlexaEventFrontend(alexaConnector, mergedMythFe);
    const mergedFe = mergeObject(alexaFe, mergedMythFe);
    const mockFe = new MockAlexaFrontend(mergedFe)
    const mergedMockFe = mergeObject(mockFe, mergedFe);
    context.currentTest['frontend'] = mergedMockFe
    return mergedMockFe;
}

export async function verifyRefreshCapability<NS extends keyof EndpointCapability>(sandbox: SinonSandbox, frontend: MythAlexaEventFrontend, isAsync: boolean, expectedNamespace: NS, expectedCapability: SubType<EndpointCapability, NS>) {
    const updateCapabilitySpy = sandbox.spy(frontend.alexaConnector, 'updateCapability')
    const watchDeltaUpdateSpy = sandbox.spy(frontend.alexaConnector, 'watchDeltaUpdate')
    frontend.alexaConnector.refreshCapability(frontend.eventDeltaId());
    await frontend.alexaConnector.completeDeltaSettings(frontend.eventDeltaId())
    if (isAsync) {
        sandbox.assert.calledOnce(watchDeltaUpdateSpy)
        sandbox.assert.calledWith(watchDeltaUpdateSpy, match.any, frontend.eventDeltaId())
    }

    sandbox.assert.calledWith(updateCapabilitySpy, expectedNamespace, expectedCapability, frontend.eventDeltaId())
}

export async function verifyState<NS extends keyof EndpointState, N extends keyof EndpointState[NS]>(
    sandbox: SinonSandbox, frontend: MythAlexaEventFrontend,
    expectedNamespace: NS, expectedName: N, expectedState: SubType<SubType<EndpointState, NS>, N>,
    triggerFunction: Function, connection: StubbedClass<mqtt.MqttClientConnection>, topicHandlerMap: TopicHandlerMap) {
    const endpointId = getEndpointName(frontend)
    acceptStateUpdate(connection, endpointId, topicHandlerMap)
    const updateStateSpy = sandbox.spy(frontend.alexaConnector, 'updateState')
    triggerFunction()
    await frontend.alexaConnector.completeDeltaState(frontend.eventDeltaId())
    sandbox.assert.calledWith(updateStateSpy, expectedNamespace, expectedName, expectedState)
}

export async function verifyRefreshState<NS extends keyof EndpointState, N extends keyof EndpointState[NS]>(
    sandbox: SinonSandbox, frontend: MythAlexaEventFrontend,
    expectedNamespace: NS, expectedName: N, expectedState: SubType<SubType<EndpointState, NS>, N>,
    connection: StubbedClass<mqtt.MqttClientConnection>, topicHandlerMap: TopicHandlerMap) {
    await verifyState(sandbox, frontend, expectedNamespace, expectedName, expectedState, () => {
        frontend.alexaConnector.refreshState(frontend.eventDeltaId())
    },connection,topicHandlerMap)
}

export async function verifyMythEventState<NS extends keyof EndpointState, N extends keyof EndpointState[NS], T extends keyof EventMapping, P extends EventMapping[T]>(
    sandbox: SinonSandbox, frontend: MythAlexaEventFrontend, eventType: T, eventMessage: P,
    expectedNamespace: NS, expectedName: N, expectedState: SubType<SubType<EndpointState, NS>, N>,
    connection: StubbedClass<mqtt.MqttClientConnection>, topicHandlerMap: TopicHandlerMap, emitBackend?: boolean) {
    await verifyState(sandbox, frontend, expectedNamespace, expectedName, expectedState, () => {
        if (emitBackend) {
            frontend.masterBackendEmitter.emit(eventType, eventMessage)
        } else {
            frontend.mythEventEmitter.emit(eventType, eventMessage)
        }
    },connection,topicHandlerMap)
}
export function toBool(data: boolean) {
    return {
        bool: data + ''
    }
}

export async function verifyActionDirective<NS extends Directive.Namespaces, N extends keyof Directive.NamedMessage[NS], DN extends keyof DirectiveResponse[NS]>(
    frontend: MythAlexaEventFrontend, connectionStub: StubbedClass<mqtt.MqttClientConnection>, topicHandlerMap: TopicHandlerMap,
    namespace: NS, name: N,
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
        const stateEmitter = <EventEmitter>frontend.alexaConnector.alexaStateEmitter
        keys(stateChange).forEach((key) => {
            stateEmitter.on('newListener', (event, listener) => {
                if (event == key) {
                    process.nextTick(() => {
                        keys(stateChange[key]).forEach((stateKey) => {
                            frontend.alexaConnector.alexaStateEmitter.emit(<never>key, <never>stateKey, <never>stateChange[key][stateKey])
                        })
                    })
                }
            })
        })
    }
    const mqttRequest: RequestMessage<any> = {
        payload: requestMessage,
        replyTopic: {
            sync: messageId.toString()
        }
    }
    const topicBase = getDirectiveTopicBase(frontend)
    const topicName = `${topicBase}${namespace}/${name}`;
    await emitTopic(topicHandlerMap, topicName, topicName, mqttRequest)
    expect(connectionStub.publish.calledWith(mqttRequest.replyTopic.sync, expectedResponse as Record<string, any>, mqtt.QoS.AtMostOnce, false), 'Unexpected response')
    expect(frontendNock.isDone()).to.be.true
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

function createContextSandbox(context: Mocha.Context): SinonSandbox {
    const sandbox = createSandbox({
        useFakeTimers: true
    })
    context.currentTest['sandbox'] = sandbox
    return sandbox
}

function restoreSandbox(context: Mocha.Context) {
    context.currentTest['sandbox'].restore()
}

export function getContextSandbox(context: Mocha.Context): SinonSandbox {
    let ret = <SinonSandbox>context.test['sandbox']
    if (!ret) {
        ret = context.currentTest['sandbox']
    }
    return ret
}
export function getTopicHandlerMap(context: Mocha.Context): TopicHandlerMap {
    return context.test['topicHandlerMap']
}

export function getConnectionHandlerStub(context: Mocha.Context): StubbedClass<mqtt.MqttClientConnection> {
    return context.test['connection']
}
type PickType<O, T> = {
    [K in keyof O]: O[K] extends T ? K : never
}[keyof O]

export function convertDateParams<T>(obj: T, fields: PickType<T, Date>[]) {
    const ret: any = {};
    fields.forEach(field => {
        ret[field] = moment.utc(obj[field]).format('YYYY-MM-DDTHH:mm:ss')
    })
    return ret;
}

function getDirectiveTopicBase(fe: Frontend.Service) {
    const endpointId = getEndpointName(fe)
    return `vestibule-bridge/${clientId}/alexa/endpoint/${endpointId}/directive/`
}

function getUpdateTopic(endpointId: string) {
    return `$aws/things/${clientId}/shadow/name/${endpointId}/update`
}

function getShadowDocumentsTopic(endpointId: string) {
    return `$aws/things/${clientId}/shadow/name/${endpointId}/update/documents`
}

export function acceptStateUpdate(connection: StubbedClass<mqtt.MqttClientConnection>,
    endpointId: string,
    topicHandlerMap: TopicHandlerMap) {
    const updateTopic = getUpdateTopic(endpointId)
    connection.publish.callsFake((topic, payload, qos, retain) => {
        if (topic === updateTopic) {
            const message = JSON.parse(payload as string)
            const clientToken = message.clientToken
            const updateShadowTopic = getShadowDocumentsTopic(endpointId)
            emitTopic(topicHandlerMap, updateShadowTopic, updateShadowTopic, {
                clientToken
            })
        }
        return Promise.resolve({})
    })
}
interface TopicHandlerMap {
    [index: string]: (topic: string, payload: ArrayBuffer, dup: boolean, qos: mqtt.QoS, retain: boolean) => void | Promise<void>
}

type StubbedClass<T> = SinonStubbedInstance<T> & T;

function createSinonStubInstance<T>(
    sandbox: SinonSandbox,
    constructor: StubbableType<T>,
    overrides?: { [K in keyof T]?: SinonStubbedMember<T[K]> },
): StubbedClass<T> {
    const stub = sandbox.createStubInstance<T>(constructor, overrides);
    return stub as unknown as StubbedClass<T>;
}

beforeEach(function () {
    const sandbox = createContextSandbox(this)
    const topicHandlerMap: TopicHandlerMap = {}

    const connectionStub = createSinonStubInstance(sandbox, mqtt.MqttClientConnection)
    connectionStub.publish.returns(Promise.resolve({}))
    connectionStub.publish.callsFake((t, p, q, r) => {
        return Promise.resolve({})
    })
    connectionStub.subscribe.callsFake((topic, qos, on_message) => {
        topicHandlerMap[topic] = on_message
        return Promise.resolve({
            topic: topic,
            qos: qos
        })
    })
    const createConnectionStub = sandbox.stub(iot, 'awsConnection').returns(connectionStub)
    this.currentTest['topicHandlerMap'] = topicHandlerMap
    this.currentTest['connection'] = connectionStub
})
afterEach(function () {
    restoreSandbox(this)
})

before(async function () {
    process.env.AWS_CLIENT_ID = clientId
    await registerAssistant()
})
