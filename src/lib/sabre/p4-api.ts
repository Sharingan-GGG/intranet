import { SabreAuthError } from "./session"
import { resolveSoapXmlFromEnv } from "@/lib/sabre/env-soap-multiline"
import {
  injectLiveSoapTokenIntoFirstBinarySecurityToken,
  injectSoapSessionTokenInTemplate,
} from "@/lib/sabre/platform-client"

function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function soapActionFromEnvelope(envelope: string): string {
  const eb = envelope.match(/<eb:Action>\s*([^<]+?)\s*<\/eb:Action>/i)
  if (eb?.[1]?.trim()) return eb[1].trim()
  const plain = envelope.match(/<Action>\s*([^<]+?)\s*<\/Action>/i)
  if (plain?.[1]?.trim()) return plain[1].trim()
  return "GetElectronicDocumentRQ"
}

function buildLegacyDocumentNumberEnvelope(
  ticketNumber: string,
  token: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
  <soap-env:Header>
    <eb:MessageHeader xmlns:eb="http://www.ebxml.org/namespaces/messageHeader" eb:version="1.0" soap-env:mustUnderstand="1">
      <eb:From><eb:PartyId eb:type="URI">SWS</eb:PartyId></eb:From>
      <eb:To><eb:PartyId eb:type="URI">Agency</eb:PartyId></eb:To>
      <eb:ConversationId>2021.01.DevStudio</eb:ConversationId>
      <eb:Action>TKT_ElectronicDocumentServicesRQ</eb:Action>
    </eb:MessageHeader>
    <wsse:Security xmlns:wsse="http://schemas.xmlsoap.org/ws/2002/12/secext">
      <wsse:BinarySecurityToken valueType="String" EncodingType="wsse:Base64Binary">${escapeXmlText(token)}</wsse:BinarySecurityToken>
    </wsse:Security>
  </soap-env:Header>
  <soap-env:Body>
    <GetElectronicDocumentRQ Version="2.2.0" xmlns="http://www.sabre.com/ns/Ticketing/EDoc" xmlns:STL="http://www.sabre.com/ns/Ticketing/EDocStl">
      <STL:STL_Header.RQ/>
      <STL:POS/>
      <SearchParameters>
        <DocumentNumber>${escapeXmlText(ticketNumber)}</DocumentNumber>
      </SearchParameters>
    </GetElectronicDocumentRQ>
  </soap-env:Body>
</soap-env:Envelope>`
}

/**
 * P4 GetElectronicDocument using `SOAP_P4_REQUEST_BODY` / `SABRE_SOAP_P4_REQUEST_BODY`
 * multiline env ({{tkt}}, session token placeholders) or a built-in DocumentNumber envelope.
 * Uses legacy `SABRE_SOAP_URL` + session binary token (same transport as P3).
 */
export async function getP4SoapXmlForTicket(
  ticketNumber: string,
  token: string
): Promise<string> {
  const soapUrl = process.env.SABRE_SOAP_URL
  if (!soapUrl?.trim()) {
    throw new Error("SABRE_SOAP_URL is not configured")
  }

  const envP4 =
    resolveSoapXmlFromEnv("SABRE_SOAP_P4_REQUEST_BODY")?.trim() ||
    resolveSoapXmlFromEnv("SOAP_P4_REQUEST_BODY")?.trim() ||
    undefined
  let body = envP4

  if (body) {
    body = body.replace(/\{\{\s*tkt\s*\}\}/gi, escapeXmlText(ticketNumber))
    body = injectSoapSessionTokenInTemplate(body, token)
    body = injectLiveSoapTokenIntoFirstBinarySecurityToken(body, token)
  } else {
    body = buildLegacyDocumentNumberEnvelope(ticketNumber, token)
  }

  const soapAction = soapActionFromEnvelope(body)

  const resp = await fetch(soapUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: soapAction,
    },
    body,
    cache: "no-store",
  })

  if (resp.status === 401) throw new SabreAuthError()
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "")
    throw new Error(`Sabre P4 SOAP ${resp.status}: ${detail.slice(0, 200)}`)
  }

  return resp.text()
}

/**
 * @deprecated Prefer {@link getP4SoapXmlForTicket} with `accountingItems[].ticketNumber` from JSON.
 * Reservation-based GetElectronicDocument by PNR.
 */
export async function getP4Xml(pnr: string, token: string): Promise<string> {
  const soapUrl = process.env.SABRE_SOAP_URL
  if (!soapUrl) throw new Error("SABRE_SOAP_URL is not configured")

  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/">
  <soap-env:Header>
    <eb:MessageHeader xmlns:eb="http://www.ebxml.org/namespaces/messageHeader"
      eb:version="1.0" SOAP-ENV:mustUnderstand="1"
      xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
      <eb:From><eb:PartyId/></eb:From>
      <eb:To><eb:PartyId/></eb:To>
      <eb:CPAId>${process.env.SABRE_PCC ?? ""}</eb:CPAId>
      <eb:Service eb:type="sabreXML">SabreXML</eb:Service>
      <eb:Action>GetElectronicDocumentRQ</eb:Action>
      <eb:ConversationId>${Date.now()}</eb:ConversationId>
    </eb:MessageHeader>
    <wsse:Security xmlns:wsse="http://schemas.xmlsoap.org/ws/2002/12/secext">
      <wsse:BinarySecurityToken>${token}</wsse:BinarySecurityToken>
    </wsse:Security>
  </soap-env:Header>
  <soap-env:Body>
    <GetElectronicDocumentRQ Version="1.0.0"
      xmlns="http://webservices.sabre.com/sabreXML/2011/10">
      <STL_Header.RQ/>
      <SearchParameters>
        <Reservation>
          <UniqueID ID="${pnr}"/>
        </Reservation>
      </SearchParameters>
    </GetElectronicDocumentRQ>
  </soap-env:Body>
</soap-env:Envelope>`

  const resp = await fetch(soapUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "GetElectronicDocumentRQ",
    },
    body: envelope,
    cache: "no-store",
  })

  if (resp.status === 401) throw new SabreAuthError()
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "")
    throw new Error(`Sabre P4 SOAP ${resp.status}: ${detail.slice(0, 200)}`)
  }

  return resp.text()
}
