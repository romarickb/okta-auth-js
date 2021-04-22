import checkEqualsText from './checkEqualsText';
import waitForDisplayed from '../wait/waitForDisplayed';
import clickElement from '../action/clickElement';

import UserProfile from '../selectors/UserProfile';
import UserHome from '../selectors/UserHome';

export default async ({
  options = { clickProfileButton: true, falseCase: false  }
}) => {
  if (options.clickProfileButton) {
    await waitForDisplayed(UserHome.profileButton, false);
    await clickElement('click', 'selector', UserHome.profileButton);
  }
  await waitForDisplayed(UserProfile.userInfo, false);
  if (options.falseCase) {
    await checkEqualsText('element', UserProfile.userInfo, false, '');
    return;
  }
  await waitForDisplayed(UserProfile.email, false);
  await checkEqualsText('element', UserProfile.email, false, process.env.USERNAME as string);
};
