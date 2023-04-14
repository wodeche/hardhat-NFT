const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const { storeImages, storeTokenURIMetadata } = require("../utils/uploadToPinata")

const FUND_AMOUNT = "10000000000000000000" //10 LINK
const imageLocation = "./images/randomNFT"
let tokenURIs = [
    "ipfs://QmUY1XYkx6c57nRPZ5mzhWg2u9By4JAsnfkCYpxbfG7QS4",
    "ipfs://QmYPX9VM52JF8BEzF4wanFB7varcWUUkj1TsFYxMJdRZDg",
    "ipfs://QmZpg39uJA9TRBvSPJ1WtbGQa7Pqv7giP2gn7aWTXTCg9o",
]

const metadataTemplate = {
    name: "",
    description: "",
    image: "",
    attributes: [
        {
            trait_type: "cuteness",
            value: 100,
        },
    ],
}

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    //get the IPFS hashes of our images
    if (process.env.UPLOAD_TO_PINATA == "ture") {
        tokenURIs = await handleTokenURIs()
    }

    //pinata

    //nft.storage

    let vrfCoordinatorV2Address, subscriptionId

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const tx = await vrfCoordinatorV2Mock.createSubscription()
        const txRecepit = await tx.wait(1)
        subscriptionId = txRecepit.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
        subscriptionId = networkConfig[chainId].subscriptionId
    }

    log("--------------------------------------------------------")

    if (process.env.UPLOAD_TO_PINATA == "true") {
        tokenURIs = await handleTokenURIs()
    }
    const args = [
        vrfCoordinatorV2Address,
        subscriptionId,
        networkConfig[chainId]["gasLane"],
        networkConfig[chainId]["mintFee"],
        networkConfig[chainId]["callbackGasLimit"],
        tokenURIs,
    ]

    const randomIpfsNft = await deploy("RandomIpfsNft", {
        from: deployer,
        args: args,
        log: true,
        waitComfirmations: network.config.blockConfirmations || 1,
    })

    log("--------------------")
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(randomIpfsNft.address, args)
    }
}

async function handleTokenURIs() {
    tokenURIs = []
    let imageUploadResponseIndex
    const { responses: imageUploadResponses, files } = await storeImages(imageLocation)
    for (imageUploadResponseIndex in imageUploadResponses) {
        let tokenURIMetadata = { ...metadataTemplate }
        tokenURIMetadata.name = files[imageUploadResponseIndex].replace(".png", "")
        tokenURIMetadata.description = `An adorable ${tokenURIMetadata.name}`
        tokenURIMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponseIndex].IpfsHash}`
        console.log(`uploading ${tokenURIMetadata.name}...`)
        //store the json to pinata/ipfs
        const metadataUploadResponse = await storeTokenURIMetadata(tokenURIMetadata)
        tokenURIs.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
    }
    console.log("Token URIs Uploaded ! they are:")
    console.log(tokenURIs)
    return tokenURIs
}

module.exports.tags = ["all", "randomipfs", "main"]
