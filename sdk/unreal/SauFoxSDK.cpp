#include "SauFoxSDK.h"

#include "GenericPlatform/GenericPlatformMisc.h"
#include "HAL/FileManager.h"
#include "HAL/PlatformFileManager.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

static FString SauFoxEnv(const TCHAR* Name)
{
	return FPlatformMisc::GetEnvironmentVariable(Name);
}

// Slot names become file names: keep them to safe characters.
static FString SlotPath(const FString& SlotName)
{
	FString Safe;
	for (TCHAR C : SlotName)
	{
		Safe.AppendChar(FChar::IsAlnum(C) || C == TEXT('_') || C == TEXT('-') ? C : TEXT('_'));
	}
	if (Safe.IsEmpty())
	{
		Safe = TEXT("Save");
	}
	return FPaths::Combine(USauFoxSDK::GetSaveDir(), Safe + TEXT(".sav"));
}

bool USauFoxSDK::IsAvailable()
{
	return !SauFoxEnv(TEXT("SAUFOX_SDK_URL")).IsEmpty() && !SauFoxEnv(TEXT("SAUFOX_SDK_TOKEN")).IsEmpty();
}

void USauFoxSDK::UnlockAchievement(const FString& Key)
{
	if (!IsAvailable())
	{
		return;
	}
	TSharedRef<FJsonObject> Body = MakeShared<FJsonObject>();
	Body->SetStringField(TEXT("key"), Key);
	FString Json;
	TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Json);
	FJsonSerializer::Serialize(Body, Writer);

	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
	Request->SetURL(SauFoxEnv(TEXT("SAUFOX_SDK_URL")) + TEXT("/v1/achievements/unlock"));
	Request->SetVerb(TEXT("POST"));
	Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Request->SetHeader(TEXT("Authorization"), TEXT("Bearer ") + SauFoxEnv(TEXT("SAUFOX_SDK_TOKEN")));
	Request->SetContentAsString(Json);
	Request->OnProcessRequestComplete().BindLambda([Key](FHttpRequestPtr, FHttpResponsePtr Response, bool bOk)
	{
		if (!bOk || !Response.IsValid() || Response->GetResponseCode() != 200)
		{
			UE_LOG(LogTemp, Warning, TEXT("SauFox: achievement %s wasn't unlocked (%d)"), *Key,
				Response.IsValid() ? Response->GetResponseCode() : 0);
		}
	});
	Request->ProcessRequest();
}

FString USauFoxSDK::GetSaveDir()
{
	FString Dir = SauFoxEnv(TEXT("SAUFOX_SAVE_DIR"));
	if (Dir.IsEmpty())
	{
		Dir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("SaveGames"));
	}
	FPlatformFileManager::Get().GetPlatformFile().CreateDirectoryTree(*Dir);
	return Dir;
}

bool USauFoxSDK::SaveGameToSauFox(USaveGame* SaveGame, const FString& SlotName)
{
	TArray<uint8> Bytes;
	if (!SaveGame || !UGameplayStatics::SaveGameToMemory(SaveGame, Bytes))
	{
		return false;
	}
	// Write beside, then move into place, so a crash never leaves half a save.
	const FString Path = SlotPath(SlotName);
	const FString Temp = Path + TEXT(".tmp");
	if (!FFileHelper::SaveArrayToFile(Bytes, *Temp))
	{
		return false;
	}
	return IFileManager::Get().Move(*Path, *Temp, true);
}

USaveGame* USauFoxSDK::LoadGameFromSauFox(const FString& SlotName)
{
	TArray<uint8> Bytes;
	if (!FFileHelper::LoadFileToArray(Bytes, *SlotPath(SlotName)))
	{
		return nullptr;
	}
	return UGameplayStatics::LoadGameFromMemory(Bytes);
}

bool USauFoxSDK::DoesSauFoxSaveExist(const FString& SlotName)
{
	return FPaths::FileExists(SlotPath(SlotName));
}
