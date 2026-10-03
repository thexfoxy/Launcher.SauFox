// SauFox launcher SDK for Unity. Drop this file anywhere under Assets/.
//
//   SauFox.Unlock("first_steps");           // unlock an achievement
//   string dir = SauFox.SaveDir;            // write your save files here
//
// Started from the SauFox launcher, the game gets SAUFOX_SDK_URL,
// SAUFOX_SDK_TOKEN and SAUFOX_SAVE_DIR. Started any other way (say, from
// the editor), achievements are skipped quietly and saves go to
// Application.persistentDataPath, so the game always runs.
using System;
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;

public class SauFox : MonoBehaviour
{
    static readonly string Url = Environment.GetEnvironmentVariable("SAUFOX_SDK_URL");
    static readonly string Token = Environment.GetEnvironmentVariable("SAUFOX_SDK_TOKEN");
    static SauFox runner;

    /// True when the game was started by the SauFox launcher.
    public static bool Available => !string.IsNullOrEmpty(Url) && !string.IsNullOrEmpty(Token);

    /// The folder for save files. The launcher keeps it in the cloud: it
    /// brings it in before the game starts and uploads it after it closes.
    public static string SaveDir
    {
        get
        {
            var dir = Environment.GetEnvironmentVariable("SAUFOX_SAVE_DIR");
            if (string.IsNullOrEmpty(dir)) dir = Path.Combine(Application.persistentDataPath, "Saves");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    /// Unlock an achievement by its key (as set in the admin panel). Safe to
    /// call more than once; the launcher shows the popup the first time.
    public static void Unlock(string key, Action<bool> done = null)
    {
        if (!Available) { done?.Invoke(false); return; }
        Runner.StartCoroutine(Post("/v1/achievements/unlock", "{\"key\":\"" + key + "\"}", done));
    }

    static SauFox Runner
    {
        get
        {
            if (runner == null)
            {
                var go = new GameObject("SauFox");
                DontDestroyOnLoad(go);
                runner = go.AddComponent<SauFox>();
            }
            return runner;
        }
    }

    static IEnumerator Post(string path, string json, Action<bool> done)
    {
        using (var req = new UnityWebRequest(Url + path, "POST"))
        {
            req.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("Authorization", "Bearer " + Token);
            yield return req.SendWebRequest();
            done?.Invoke(req.responseCode == 200);
        }
    }
}
