# Troubleshooting and FAQ

Common issues and how to resolve them.

## ❓ Frequently Asked Questions

### 1. Why did my job fail?

Check the **Logs** in the Queue sidebar. Common reasons include:

- Audio engine subprocess crashed (try restarting the app).
- Segment exceeded character limit (re-analyze the text).
- Disk space is full.

### 2. Why does the voice sound robotic?

- Ensure your samples are clean and have no background noise.
- Check if you recorded too close or too far from the mic.
- Try a different set of samples and click **Rebuild Voice**.

### 3. How do I fix "Long Sentence" warnings?

- Go to the **Performance** tab.
- Look for segments highlighted in Yellow or Red.
- Manually split the segment into two smaller ones using the editor.

## 🛠️ Common Workflows

### How to Retry a Failed Job

1. Open the **Queue** sidebar.
2. Find the failed job (highlighted in red).
3. Click the **Requeue** icon (circular arrow).

### How to Manually Rebuild a Voice

1. Go to the **AI Voice Lab** (Voices tab).
2. Click **Manage Samples** on the profile.
3. Add/Remove samples as needed.
4. Click the **Rebuild Now** button that appears in the warning banner.

---

[[Home]] | [[Queue and Jobs]] | [[Voices and Voice Profiles]]
