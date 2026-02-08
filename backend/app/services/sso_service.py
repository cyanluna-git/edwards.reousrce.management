"""
SSO Service for SAML 2.0 Authentication
"""

import logging
from typing import Dict, Any, Optional
from onelogin.saml2.auth import OneLogin_Saml2_Auth
from onelogin.saml2.utils import OneLogin_Saml2_Utils
from app.core.config import settings

logger = logging.getLogger(__name__)

class SSOService:
    @staticmethod
    def prepare_saml_request(request_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare the SAML request dictionary from the FastAPI request.
        """
        # Ensure we have a valid port
        port = request_data.get('server_port')
        if not port:
            port = 443 if request_data.get('https') == 'on' else 80
            
        return {
            'https': request_data.get('https', 'off'),
            'http_host': request_data.get('http_host'),
            'script_name': request_data.get('script_name'),
            'server_port': str(port),
            'get_data': request_data.get('get_data', {}),
            'post_data': request_data.get('post_data', {}),
            'query_string': request_data.get('query_string', '')
        }

    @staticmethod
    def get_saml_settings() -> Dict[str, Any]:
        """
        Get SAML settings based on app configuration.
        """
        return {
            "strict": settings.SAML_STRICT,
            "debug": settings.SAML_DEBUG,
            "sp": {
                "entityId": settings.SAML_ENTITY_ID,
                "assertionConsumerService": {
                    "url": settings.SAML_ACS_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                },
                "singleLogoutService": {
                    "url": settings.SAML_SLO_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                },
                "NameIDFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
            },
            "idp": {
                "entityId": settings.SAML_IDP_ENTITY_ID,
                "singleSignOnService": {
                    "url": settings.SAML_IDP_SSO_URL,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
                },
                "x509cert": settings.SAML_IDP_X509_CERT,
            }
        }

    @classmethod
    def init_saml_auth(cls, request_data: Dict[str, Any]) -> OneLogin_Saml2_Auth:
        """
        Initialize the OneLogin SAML Auth object.
        """
        saml_request = cls.prepare_saml_request(request_data)
        saml_settings = cls.get_saml_settings()
        return OneLogin_Saml2_Auth(saml_request, saml_settings)

    @staticmethod
    def extract_user_attributes(auth: OneLogin_Saml2_Auth) -> Dict[str, str]:
        """
        Extract user attributes from the SAML assertion.
        """
        attributes = auth.get_attributes()
        logger.debug(f"SAML Attributes: {attributes}")
        
        # Entra ID standard attribute mapping
        # These keys might vary based on Entra ID configuration
        email = (
            attributes.get('email', [None])[0] or 
            attributes.get('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', [None])[0]
        )
        
        name = (
            attributes.get('name', [None])[0] or 
            attributes.get('http://schemas.xmlsoap.org/ws/2005/05/identity/claims/displayname', [None])[0]
        )
        
        return {
            "email": email,
            "name": name
        }
