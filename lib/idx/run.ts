/* eslint-disable max-statements, complexity */
import { interact } from './interact';
import { introspect } from './introspect';
import { remediate } from './remediate';
import { FlowMonitor } from './flowMonitors';
import * as remediators from './remediators';
import { 
  OktaAuth,
  IdxOptions,
  IdxStatus,
  IdxTransaction,
  IdxFeature,
  NextStep,
} from '../types';
import { IdxResponse, IdxRemediation } from './types/idx-js';

export type RemediationFlow = Record<string, typeof remediators.Remediator>;
export interface RunOptions {
  flow?: RemediationFlow;
  actions?: string[];
  flowMonitor?: FlowMonitor;
}

function getEnabledFeatures(idxResponse: IdxResponse): IdxFeature[] {
  const res = [];
  const { actions, neededToProceed } = idxResponse;

  if (actions['currentAuthenticator-recover']) {
    res.push(IdxFeature.PASSWORD_RECOVERY);
  }

  if (neededToProceed.some(({ name }) => name === 'select-enroll-profile')) {
    res.push(IdxFeature.REGISTRATION);
  }

  if (neededToProceed.some(({ name }) => name === 'redirect-idp')) {
    res.push(IdxFeature.SOCIAL_IDP);
  }

  return res;
}

function getAvailableSteps(remediations: IdxRemediation[]): NextStep[] {
  const res = [];

  const remediatorMap = Object.values(remediators).reduce((map, remediatorClass) => {
    // Only add concrete subclasses to the map
    if (remediatorClass.remediationName) {
      map[remediatorClass.remediationName] = remediatorClass;
    }
    return map;
  }, {});

  for (let remediation of remediations) {
    const T = remediatorMap[remediation.name];
    if (T) {
      const remediator = new T(remediation);
      res.push (remediator.getNextStep());
    }
  }

  return res;
}

export async function run(
  authClient: OktaAuth, 
  options: RunOptions & IdxOptions,
): Promise<IdxTransaction> {
  let tokens;
  let nextStep;
  let messages;
  let error;
  let meta;
  let enabledFeatures;
  let availableSteps;
  let status = IdxStatus.PENDING;
  let shouldClearTransaction = false;

  try {
    // Start/resume the flow
    const { interactionHandle, meta: metaFromResp } = await interact(authClient, options); 

    // Introspect to get idx response
    const idxResponse = await introspect(authClient, { interactionHandle });

    if (!options.flow && !options.actions) {
      // handle start transaction
      meta = metaFromResp;
      enabledFeatures = getEnabledFeatures(idxResponse);
      availableSteps = getAvailableSteps(idxResponse.neededToProceed);
    } else {
      const values: remediators.RemediationValues = { 
        ...options, 
        stateHandle: idxResponse.rawIdxState.stateHandle 
      };

      // Can we handle the remediations?
      const { 
        idxResponse: idxResponseFromResp, 
        nextStep: nextStepFromResp,
        terminal,
        canceled,
        messages: messagesFromResp,
      } = await remediate(idxResponse, values, options);

      // Track fields from remediation response
      nextStep = nextStepFromResp;
      messages = messagesFromResp;

      // Save intermediate idx response in storage to reduce introspect call
      if (nextStep && idxResponseFromResp) {
        authClient.transactionManager.saveIdxResponse(idxResponseFromResp.rawIdxState);
      }

      if (terminal) {
        status = IdxStatus.TERMINAL;
        shouldClearTransaction = true;
      } if (canceled) {
        status = IdxStatus.CANCELED;
        shouldClearTransaction = true;
      } else if (idxResponseFromResp?.interactionCode) { 
        const {
          clientId,
          codeVerifier,
          ignoreSignature,
          redirectUri,
          urls,
          scopes,
        } = metaFromResp;
        tokens = await authClient.token.exchangeCodeForTokens({
          interactionCode: idxResponseFromResp.interactionCode,
          clientId,
          codeVerifier,
          ignoreSignature,
          redirectUri,
          scopes
        }, urls);

        status = IdxStatus.SUCCESS;
        shouldClearTransaction = true;
      }
    }
  } catch (err) {
    error = err;
    status = IdxStatus.FAILURE;
    shouldClearTransaction = true;
  }

  if (shouldClearTransaction) {
    authClient.transactionManager.clear();
  }
  
  return {
    status,
    ...(meta && { meta }),
    ...(enabledFeatures && { enabledFeatures }),
    ...(availableSteps && { availableSteps }),
    ...(tokens && { tokens: tokens.tokens }),
    ...(nextStep && { nextStep }),
    ...(messages && { messages }),
    ...(error && { error }),
  };
}
