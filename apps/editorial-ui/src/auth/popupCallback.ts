// Entry point for popup-callback.html. Hands the authorization response back
// to the window that opened the popup; the exchange happens over there.

import { userManager } from './userManager'

void userManager.signinPopupCallback()
