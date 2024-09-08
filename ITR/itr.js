console.clear();
import {
	AccountId,
	PrivateKey,
	Client,
	TokenCreateTransaction,
	TokenType,
	TokenSupplyType,
	TransferTransaction,
	AccountBalanceQuery,
	TokenAssociateTransaction,
	AccountCreateTransaction,
    TokenDeleteTransaction,
} from '@hashgraph/sdk';

import dotenv from 'dotenv';

dotenv.config();
const myAccountId = AccountId.fromString(process.env.ACCOUNT_ID);
const myPrivateKey = PrivateKey.fromStringECDSA(process.env.ACCOUNT_PRIVATE_KEY);

if (myAccountId == null || myPrivateKey == null) {
	throw new Error(
	  "Environment variables myAccountId and myPrivateKey must be present"
	);
}


const client = Client.forTestnet().setOperator(myAccountId, myPrivateKey);


let newAccountId, newAccountPrivateKey, aliceId, aliceKey;
let isSetupDone = false;
async function environmentSetup() {
	isSetupDone = true;
	if (isSetupDone) {
        console.log("Environment setup already completed.");
        return;
    }
	newAccountPrivateKey = PrivateKey.generateED25519();
	const newAccountPublicKey = newAccountPrivateKey.publicKey;

	const newAccount = await new AccountCreateTransaction()
		.setKey(newAccountPublicKey)
		.execute(client);

	
	const getReceipt = await newAccount.getReceipt(client);
	newAccountId = getReceipt.accountId;
	console.log(`- Created new account with ID: ${newAccountId}`);


	aliceKey = PrivateKey.generateED25519();
	const alicePublicKey = aliceKey.publicKey;

	const aliceAccount = await new AccountCreateTransaction()
		.setKey(alicePublicKey)
		.execute(client);

	const getAliceReceipt = await aliceAccount.getReceipt(client);
	aliceId = getAliceReceipt.accountId;
	console.log(`- Created Alice's account with ID: ${aliceId}`);
	return true;
}

async function createFungibleToken() {
	if (!newAccountId || !aliceId) {
		throw new Error("Environment setup not complete. Please run environmentSetup first.");
	}

	const supplyKey = PrivateKey.generate();

	let tokenCreateTx = await new TokenCreateTransaction()
		.setTokenName("HDR tokens")
		.setTokenSymbol("HDR")
		.setTokenType(TokenType.FungibleCommon)
		.setDecimals(2)
		.setInitialSupply(100000000000000)
		.setTreasuryAccountId(newAccountId)
		.setSupplyType(TokenSupplyType.Infinite)
		.setSupplyKey(supplyKey)
		.freezeWith(client);

	let tokenCreateSign = await tokenCreateTx.sign(newAccountPrivateKey);
	let tokenCreateSubmit = await tokenCreateSign.execute(client);
	let tokenCreateRx = await tokenCreateSubmit.getReceipt(client);
	let tokenId = tokenCreateRx.tokenId;
	const tokenExplorerUrl = `https://hashscan.io/testnet/token/${tokenId}`;
	
	const accountBalanceFetchApiUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${myAccountId}/tokens?token.id=${tokenId}&limit=1&order=desc`;    

	console.log(`HDR token created at  ${tokenExplorerUrl} `);
	console.log(` account balance is ${accountBalanceFetchApiUrl} `);



	let associateAliceTx = await new TokenAssociateTransaction()
		.setAccountId(aliceId)
		.setTokenIds([tokenId])
		.freezeWith(client)
		.sign(aliceKey);
	let associateAliceTxSubmit = await associateAliceTx.execute(client);
	let associateAliceRx = await associateAliceTxSubmit.getReceipt(client);
	console.log(`- Token association with Alice's account: ${associateAliceRx.status} \n`);

	let balanceCheckTx = await new AccountBalanceQuery().setAccountId(myAccountId).execute(client);
	console.log(`- Treasury balance: ${balanceCheckTx.tokens._map.get(tokenId.toString())} units of token ID ${tokenId}`);
	
	balanceCheckTx = await new AccountBalanceQuery().setAccountId(aliceId).execute(client);
	console.log(`- Alice's balance: ${balanceCheckTx.tokens._map.get(tokenId.toString())} units of token ID ${tokenId}`);

	let tokenTransferTx = await new TransferTransaction()
		.addTokenTransfer(tokenId, myAccountId, -5)
		.addTokenTransfer(tokenId, aliceId, 5)
		.freezeWith(client)
		.sign(newAccountPrivateKey);
	let tokenTransferSubmit = await tokenTransferTx.execute(client);
	let tokenTransferRx = await tokenTransferSubmit.getReceipt(client);
	console.log(`\n- Stablecoin transfer from Treasury to Alice: ${tokenTransferRx.status} \n`);

	balanceCheckTx = await new AccountBalanceQuery().setAccountId(myAccountId).execute(client);
	console.log(`- Treasury balance: ${balanceCheckTx.tokens._map.get(tokenId.toString())} units of token ID ${tokenId}`);

	balanceCheckTx = await new AccountBalanceQuery().setAccountId(aliceId).execute(client);
	console.log(`- Alice's balance: ${balanceCheckTx.tokens._map.get(tokenId.toString())} units of token ID ${tokenId}`);


   
    console.log(`\n- Initiating token deletion...`);
    let tokenDeleteTx = await new TokenDeleteTransaction()
        .setTokenId(tokenId)
        .freezeWith(client)
        .sign(newAccountPrivateKey);
    let tokenDeleteSubmit = await tokenDeleteTx.execute(client);
    let tokenDeleteRx = await tokenDeleteSubmit.getReceipt(client);
    console.log(`- Token deletion status: ${tokenDeleteRx.status}`);

}

async function main() {
    try {
        await environmentSetup();
        await createFungibleToken();
    } catch (error) {
        console.error("Error occurred:", error);
        return; 
    }
}
