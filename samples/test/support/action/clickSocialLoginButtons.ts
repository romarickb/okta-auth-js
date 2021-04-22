import { waitForPopup } from '../../util/browserUtils';
import clickElement from './clickElement';
import { OktaSignIn } from '../selectors';

export default async () => {
  await waitForPopup(() => clickElement('click', 'selector', OktaSignIn.siginWithFacebookBtn));
  await waitForPopup(() => clickElement('click', 'selector', OktaSignIn.siginWithGoogleBtn));
};
