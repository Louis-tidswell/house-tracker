# House Tracker — Share Setup

## Android (PWA Share Target)

1. Deploy the app to Vercel (or your hosting platform).
2. Open the deployed URL in **Chrome** on your Android phone.
3. Tap the three-dot menu → **"Add to Home Screen"** (or "Install app").
4. Accept the prompt — this installs House Tracker as a PWA.
5. Open the **realestate.com.au** or **Domain** app.
6. Find a listing and tap **Share**.
7. Choose **"House Tracker"** from the Android share sheet.
8. The app opens `/properties/new` with the shared URL prefilled in the form.

> **Note:** The PWA share target only works after the app is installed
> to the home screen via Chrome. It will not appear in the share sheet
> if you only have the site bookmarked.

---

## iPhone (Shortcuts Workflow)

iOS does not support PWA share targets, so we use an Apple Shortcut instead.

### Create the Shortcut

1. Open the **Shortcuts** app on your iPhone.
2. Tap **+** to create a new shortcut.
3. Name it **"Save House"**.
4. Tap **ⓘ** (details) → enable **"Show in Share Sheet"**.
5. Under "Share Sheet Receives", select **URLs** and **Text**.
6. Add the action: **"Get URLs from Input"** (set Input to "Shortcut Input").
7. Add the action: **"Open URLs"**.
8. Set the URL to:

```
https://YOUR_VERCEL_URL/properties/new?sourceUrl=[URLs]
```

Replace `YOUR_VERCEL_URL` with your actual deployed domain (e.g. `house-tracker-abc.vercel.app`).

The `[URLs]` variable is the magic variable from step 6 — tap and select it from the variable picker.

### Use the Shortcut

1. Open the **realestate.com.au** or **Domain** app.
2. Find a listing and tap **Share**.
3. Scroll the share sheet and choose **"Save House"**.
4. Safari/your browser opens with the listing URL prefilled in the Add Property form.
5. Fill in any extra details and tap **Save Property**.

---

## Manual Browser Usage

You can also add a property by visiting:

```
https://YOUR_VERCEL_URL/properties/new?sourceUrl=https://www.realestate.com.au/property-...
```

Query parameters accepted:

| Param        | Purpose                                      |
|--------------|----------------------------------------------|
| `sourceUrl`  | Listing URL — prefills the URL field         |
| `title`      | Property title — prefills address/title      |
| `sharedText` | Shared text — URL is extracted if present    |
| `text`       | Alternative to sharedText (used by PWA)      |
