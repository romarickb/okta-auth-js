import { getAppUrl } from '../../util/appUtils';

export default async (
  url = '/',
  queryParams: Record<string, string> = {}
) => {
  await browser.url(getAppUrl(url, queryParams));
};
