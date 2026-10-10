# iOS TestFlight setup

The repository already has a simulator-only iOS workflow. Use `.github/workflows/ios-testflight.yml` when Apple signing and App Store Connect access are ready.

## Before the first upload

1. Enroll in the Apple Developer Program and confirm the membership is active.
2. In App Store Connect, create two iOS app records, one for each exact bundle ID:
   - Driver: `com.tibasupplies.driver`
   - Office: `com.tibasupplies.office`
3. Create an App Store Connect API key with access to manage the app and signing assets. Keep the downloaded `.p8` file private; Apple only lets you download it once.
4. In GitHub, open **Settings → Secrets and variables → Actions** and add these repository secrets:
   - `APPLE_TEAM_ID`: the Apple Developer Team ID.
   - `ASC_API_KEY_ID`: the API key ID.
   - `ASC_API_ISSUER_ID`: the API key issuer ID.
   - `ASC_API_PRIVATE_KEY`: the full contents of the downloaded `.p8` file.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key. Do not use a Supabase service-role or secret key here.
5. In GitHub Actions, run **Build and upload Tiba Supplies iOS apps to TestFlight** and choose `driver`, `office`, or `both`.

The workflow signs with Xcode automatic signing, exports an App Store Connect IPA, uploads it to Apple, and retains the IPA as a short-lived GitHub Actions artifact. It does not publish an App Store release. Apple must finish processing each upload before it can be assigned to TestFlight testers.

Never paste the Apple private key or any signing secret into chat, issues, pull requests, or source files. Add them only in GitHub Actions secrets.
