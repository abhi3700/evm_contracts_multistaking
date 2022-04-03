# Deployment Details

## Rinkeby Testnet

* Etherscan: <https://rinkeby.etherscan.io/address/0x0FF7850D1230e2B7A1aEc52CcBb5208A05cb429c>
* Execution

```console
❯ npx hardhat run deployment/testnet/rinkeby/deploy.ts  --network rinkeby
No need to generate any newer typings.
Token deployed to:  0xc95df74125FB14B5d93f490C449544f95F3fa08A
The transaction that was sent to the network to deploy the token contract: 0x51f202d1ff3f6e82b8515b4f18e7a4ea18492bb362c93002a940c99aa6ab963b
staking rewards Token deployed to:  0xE0C6EA5ad4368F4350aA5a2a9a1FcaB84194A30e
The transaction that was sent to the network to deploy the token contract: 0xca372b8d42a39bf7d00e412971a2704680ecfeee4f666c9cfad2f9c168c8925a
Staking deployed to:  0x0FF7850D1230e2B7A1aEc52CcBb5208A05cb429c
The transaction that was sent to the network to deploy the staking contract: 0x994db9dada4e3be0038a1787f8355a398545e00c10fd19ac12098c42b7cdac97
Owner set reward rate & its transaction hash is  0xae8cd00428617b18759d0b7ee43fb55d083fef8f7b4b7f21773b4048924ea226
Owner minted reward tokens to the staking contract & its transaction hash is  0x488601b6628e9990d58efa7762d67f03b05828110e1f36438819c629eeabad72
```