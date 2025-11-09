from stellar_sdk import Server, Keypair, Network
from stellar_sdk import SorobanServer
from bindings.bindings import Client
import requests

CONTRACT_ADDRESS = "CANGKXDSQFNZAJH6RVE6CXAACUSZPZC7TV2NCRAB3ZRQVJNHHLSBDSVC"

keypair = Keypair.random()
#account_id = keypair.public_key
#secret = keypair.secret

keypair = keypair.from_secret("SBTLGIB3ZXM7VSHDWD53CCIE5EPOHM4HDQUIYRFIBH7RGDC36N2GLDNM")
account_id = "GDO4MTWYO6ORDEKHDE2KCFYORWZJSSVMP4MAIFJX43FEPUBH2REFHB2X"
secret = "SBTLGIB3ZXM7VSHDWD53CCIE5EPOHM4HDQUIYRFIBH7RGDC36N2GLDNM"

print("Generated account:")
print(f"  Public Key: {account_id}")
print(f"  Secret: {secret}")

response = requests.get("http://localhost:8000/friendbot", params={'addr': account_id})
print(f"Friendbot responded with {response}")
print()

client = Client(
    CONTRACT_ADDRESS,
    rpc_url="http://localhost:8000/rpc",
    network_passphrase=Network.STANDALONE_NETWORK_PASSPHRASE,
)

#tx = client.init(admin=account_id, source=account_id, signer=keypair)
#tx = tx.sign_and_submit(keypair)
#print("Account initialized on the contract.")

for i in range(128):
    try:
        tx = client.extend_init(source=account_id, signer=keypair)
        tx.sign(keypair)
        result = tx.submit()
        print(f"✅ Initialized canvas row {i + 1}/128: {result}")
    except Exception as e:
        print(f"❌ Failed to initialize row {i + 1}")
        import traceback; traceback.print_exc()

        # Get underlying failure details if available
        if hasattr(e, "tx_result"):
            print("Soroban tx_result XDR:", e.tx_result)
        if hasattr(e, "tx_result_xdr"):
            print("Soroban tx_result_xdr:", e.tx_result_xdr)
        if hasattr(e, "result_meta_xdr"):
            print("Soroban result_meta_xdr:", e.result_meta_xdr)

        if 'tx' in locals():
            print("TX XDR:", tx.to_xdr())

    