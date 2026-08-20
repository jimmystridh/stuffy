export interface GoogleServiceAccountCredentials {
  client_email: string
  private_key: string
}

type CredentialEnvironment = Record<string, string | undefined>

function readEnvironmentValue(
  environment: CredentialEnvironment,
  variableName: string,
) {
  const value = environment[variableName]?.trim()
  return value || undefined
}

function readCredentialPair(
  environment: CredentialEnvironment,
  clientEmailVariable: string,
  privateKeyVariable: string,
) {
  const clientEmail = readEnvironmentValue(environment, clientEmailVariable)
  const privateKey = readEnvironmentValue(environment, privateKeyVariable)

  if (!clientEmail && !privateKey) {
    return undefined
  }

  if (!clientEmail || !privateKey) {
    throw new Error(
      `${clientEmailVariable} and ${privateKeyVariable} must either both be configured or both be omitted for Application Default Credentials`,
    )
  }

  return {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, '\n'),
  } satisfies GoogleServiceAccountCredentials
}

export function getGoogleCloudProject(
  environment: CredentialEnvironment = process.env,
) {
  return (
    readEnvironmentValue(environment, 'FIREBASE_ADMIN_PROJECT_ID') ||
    readEnvironmentValue(environment, 'GOOGLE_CLOUD_PROJECT') ||
    readEnvironmentValue(environment, 'GCLOUD_PROJECT') ||
    readEnvironmentValue(environment, 'NEXT_PUBLIC_FIREBASE_PROJECT_ID')
  )
}

export function getFirebaseAdminCredentials(
  environment: CredentialEnvironment = process.env,
) {
  return readCredentialPair(
    environment,
    'FIREBASE_ADMIN_CLIENT_EMAIL',
    'FIREBASE_ADMIN_PRIVATE_KEY',
  )
}

export function getVertexCredentials(
  environment: CredentialEnvironment = process.env,
) {
  const hasVertexOverride = Boolean(
    readEnvironmentValue(environment, 'GOOGLE_VERTEX_CLIENT_EMAIL') ||
      readEnvironmentValue(environment, 'GOOGLE_VERTEX_PRIVATE_KEY'),
  )

  if (hasVertexOverride) {
    return readCredentialPair(
      environment,
      'GOOGLE_VERTEX_CLIENT_EMAIL',
      'GOOGLE_VERTEX_PRIVATE_KEY',
    )
  }

  return getFirebaseAdminCredentials(environment)
}
