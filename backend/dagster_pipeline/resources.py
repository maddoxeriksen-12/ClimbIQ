"""
Dagster Resources for ClimbIQ Pipeline

Provides configured resources for database access and external services.
"""

from dagster import ConfigurableResource, InitResourceContext
from supabase import create_client, Client
from pydantic import Field
import os


class SupabaseResource(ConfigurableResource):
    """Supabase client resource for database operations"""
    
    url: str = Field(
        default_factory=lambda: os.getenv("SUPABASE_URL", ""),
        description="Supabase project URL"
    )
    key: str = Field(
        default_factory=lambda: os.getenv("SUPABASE_SERVICE_KEY", ""),
        description="Supabase service role key"
    )
    
    _client: Client = None
    
    @property
    def client(self) -> Client:
        """Get or create the Supabase client"""
        if self._client is None:
            if not self.url or not self.key:
                raise ValueError(
                    "SUPABASE_URL and SUPABASE_SERVICE_KEY must be configured. "
                    "Set them as environment variables or in the resource config."
                )
            self._client = create_client(self.url, self.key)
        return self._client
    
    def setup_for_execution(self, context: InitResourceContext) -> "SupabaseResource":
        """Initialize the client when the resource is used"""
        # Ensure client is created
        _ = self.client
        return self


class LiteraturePriorsResource(ConfigurableResource):
    """Resource containing literature-based prior estimates"""
    
    # Default literature priors based on climbing research
    # These can be overridden via config
    priors: dict = Field(
        default={
            # Sleep effects
            "sleep_quality": {"mean": 0.15, "std": 0.05, "source": "literature"},
            "sleep_hours": {"mean": 0.08, "std": 0.03, "source": "literature"},
            
            # Energy and motivation
            "energy_level": {"mean": 0.20, "std": 0.06, "source": "literature"},
            "motivation": {"mean": 0.12, "std": 0.04, "source": "literature"},
            
            # Recovery factors
            "days_since_last_session": {"mean": -0.05, "std": 0.02, "source": "literature"},
            "days_since_rest_day": {"mean": -0.03, "std": 0.02, "source": "literature"},
            "muscle_soreness": {"mean": -0.10, "std": 0.04, "source": "literature"},
            
            # Stress factors
            "stress_level": {"mean": -0.15, "std": 0.05, "source": "literature"},
            "performance_anxiety": {"mean": -0.18, "std": 0.06, "source": "literature"},
            "fear_of_falling": {"mean": -0.08, "std": 0.03, "source": "literature"},
            
            # Substances
            "caffeine_today": {"mean": 0.05, "std": 0.03, "source": "literature"},
            "alcohol_last_24h": {"mean": -0.12, "std": 0.05, "source": "literature"},
            
            # Injury
            "injury_severity": {"mean": -0.25, "std": 0.08, "source": "literature"},
            
            # Environmental
            "hydration_status": {"mean": 0.06, "std": 0.03, "source": "literature"},
            "temperature": {"mean": -0.02, "std": 0.01, "source": "literature"},
            "humidity": {"mean": -0.03, "std": 0.02, "source": "literature"},
        },
        description="Literature-based prior estimates for coefficient effects"
    )
    
    def get_prior(self, variable: str) -> dict:
        """Get the prior for a specific variable"""
        return self.priors.get(variable, {"mean": 0.0, "std": 0.1, "source": "default"})
    
    def get_all_priors(self) -> dict:
        """Get all literature priors"""
        return self.priors.copy()

