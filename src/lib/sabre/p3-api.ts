import { SabreAuthError } from "./session"

export async function getP3Xml(pnr: string, token: string): Promise<string> {
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
      <eb:Action>TravelItineraryHistoryLLSRQ</eb:Action>
      <eb:ConversationId>${Date.now()}</eb:ConversationId>
    </eb:MessageHeader>
    <wsse:Security xmlns:wsse="http://schemas.xmlsoap.org/ws/2002/12/secext">
      <wsse:BinarySecurityToken>${token}</wsse:BinarySecurityToken>
    </wsse:Security>
  </soap-env:Header>
  <soap-env:Body>
    <TravelItineraryHistoryRQ ReturnHostCommand="true" Version="2.3.0"
      xmlns="http://webservices.sabre.com/sabreXML/2011/10">
      <UniqueID ID="${pnr}"/>
    </TravelItineraryHistoryRQ>
  </soap-env:Body>
</soap-env:Envelope>`

  const resp = await fetch(process.env.SABRE_SOAP_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "TravelItineraryHistoryLLSRQ",
    },
    body: envelope,
    cache: "no-store",
  })

  if (resp.status === 401) throw new SabreAuthError()
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "")
    throw new Error(`Sabre P3 SOAP ${resp.status}: ${detail.slice(0, 200)}`)
  }

  return resp.text()
}
