// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract VCManager {
    struct VCSchema {
        string id;
        string name;
        string schema;
        string issuerDID;
        string imageLink;
        uint version;
        bool isActive;
    }

    struct VCStatus {
        string id;
        string issuerDID;
        string holderDID;
        string vcType;
        string schemaID;
        uint schemaVersion;
        bool status;
        string expiredAt;
        string hash;
    }

    mapping(string => mapping(uint => VCSchema)) private schemaMap;
    mapping(string => uint) private schemaLatestVersion;
    mapping(string => VCStatus) private vcMap;
    string[] private vcIds;
    string[] private vcSchemas;

    event SchemaCreated(string indexed id, string name, string schema, string indexed issuerDID, string imageLink, uint version, uint256 timestamp);
    event SchemaUpdated(string indexed id, string schema, string indexed issuerDID, string imageLink, uint oldVersion, uint newVersion, uint256 timestamp);
    event SchemaDeactivated(string indexed id, uint indexed version, string issuerDID, uint256 timestamp);
    event SchemaReactivated(string indexed id, uint indexed version, string issuerDID, uint256 timestamp);

    function createVCSchema(string memory _id, string memory _name, string memory _schema, string memory _issuerDID, string memory _imageLink) public {
        require(bytes(schemaMap[_id][1].id).length == 0, "Schema already exists");
        schemaMap[_id][1] = VCSchema({id: _id, name: _name, schema: _schema, issuerDID: _issuerDID, imageLink: _imageLink, version: 1, isActive: true});
        vcSchemas.push(_id);
        schemaLatestVersion[_id] = 1;
        emit SchemaCreated(_id, _name, _schema, _issuerDID, _imageLink, 1, block.timestamp);
    }

    function updateVCSchema(string memory _id, string memory _newSchema, string memory _newImageLink) public {
        require(bytes(schemaMap[_id][1].id).length != 0, "Schema not found");
        uint oldVersion = schemaLatestVersion[_id];
        schemaLatestVersion[_id] += 1;
        uint newVersion = schemaLatestVersion[_id];
        schemaMap[_id][newVersion] = VCSchema({id: schemaMap[_id][1].id, name: schemaMap[_id][1].name, schema: _newSchema, issuerDID: schemaMap[_id][1].issuerDID, imageLink: _newImageLink, version: newVersion, isActive: true});
        emit SchemaUpdated(_id, _newSchema, schemaMap[_id][1].issuerDID, _newImageLink, oldVersion, newVersion, block.timestamp);
    }

    function deactivateVCSchema(string memory _id, uint _version) public {
        VCSchema storage schema = schemaMap[_id][_version];
        require(bytes(schema.id).length != 0, "Schema not found");
        schema.isActive = false;
        emit SchemaDeactivated(_id, _version, schema.issuerDID, block.timestamp);
    }

    function reactivateVCSchema(string memory _id, uint _version) public {
        VCSchema storage schema = schemaMap[_id][_version];
        require(bytes(schema.id).length != 0, "Schema not found");
        schema.isActive = true;
        emit SchemaReactivated(_id, _version, schema.issuerDID, block.timestamp);
    }

    function issueVC(string memory _id, string memory _issuerDID, string memory _holderDID, string memory _vcType, string memory _schemaID, uint _schemaVersion, string memory _expiredAt, string memory _hash) public {
        require(bytes(vcMap[_id].id).length == 0, "VC already exists");
        require(schemaMap[_schemaID][_schemaVersion].isActive, "Schema is inactive");
        vcMap[_id] = VCStatus({id: _id, issuerDID: _issuerDID, holderDID: _holderDID, vcType: _vcType, schemaID: _schemaID, schemaVersion: _schemaVersion, status: true, expiredAt: _expiredAt, hash: _hash});
        vcIds.push(_id);
    }

    function renewVC(string memory _id, string memory _expiredAt, string memory _hash) public {
        VCStatus storage vc = vcMap[_id];
        require(bytes(vc.id).length != 0, "VC not found");
        vc.expiredAt = _expiredAt;
        vc.hash = _hash;
        vc.status = true;
    }

    function updateVC(string memory _oldID, string memory _newID, string memory _issuerDID, string memory _holderDID, string memory _vcType, string memory _schemaID, uint _schemaVersion, string memory _expiredAt, string memory _hash) public {
        VCStatus storage vc = vcMap[_oldID];
        require(bytes(vc.id).length != 0, "VC not found");
        require(vc.status, "VC is inactive");
        vc.status = false;
        require(bytes(vcMap[_newID].id).length == 0, "VC already exists");
        require(schemaMap[_schemaID][_schemaVersion].isActive, "Schema is inactive");
        vcMap[_newID] = VCStatus({id: _newID, issuerDID: _issuerDID, holderDID: _holderDID, vcType: _vcType, schemaID: _schemaID, schemaVersion: _schemaVersion, status: true, expiredAt: _expiredAt, hash: _hash});
        vcIds.push(_newID);
    }

    function revokeVC(string memory _id) public {
        VCStatus storage vc = vcMap[_id];
        require(bytes(vc.id).length != 0, "VC not found");
        vc.status = false;
    }

    function verifyVC(string memory _id, string memory _hash) public view returns (bool) {
        VCStatus memory vc = vcMap[_id];
        return (vc.status && keccak256(bytes(vc.hash)) == keccak256(bytes(_hash)));
    }

    function getSchemasCount() public view returns (uint256) {
        uint256 totalCount = 0;
        for (uint i = 0; i < vcSchemas.length; i++) {
            totalCount += schemaLatestVersion[vcSchemas[i]];
        }
        return totalCount;
    }

    function getAllSchemasPaginated(uint256 offset, uint256 limit) public view returns (VCSchema[] memory schemas, uint256 total, uint256 returned) {
        total = getSchemasCount();
        require(offset < total, "Offset exceeds total");
        require(limit > 0 && limit <= 1000, "Invalid limit");
        uint256 remaining = total - offset;
        returned = remaining < limit ? remaining : limit;
        schemas = new VCSchema[](returned);
        uint256 currentIndex = 0;
        uint256 resultIndex = 0;
        for (uint i = 0; i < vcSchemas.length && resultIndex < returned; i++) {
            string memory schemaId = vcSchemas[i];
            uint latestVersion = schemaLatestVersion[schemaId];
            for (uint j = 1; j <= latestVersion && resultIndex < returned; j++) {
                if (currentIndex >= offset) {
                    schemas[resultIndex] = schemaMap[schemaId][j];
                    resultIndex++;
                }
                currentIndex++;
            }
        }
        return (schemas, total, returned);
    }

    function getLatestSchemasPaginated(uint256 offset, uint256 limit) public view returns (VCSchema[] memory schemas, uint256 total, uint256 returned) {
        total = vcSchemas.length;
        require(offset < total, "Offset exceeds total");
        require(limit > 0 && limit <= 1000, "Invalid limit");
        uint256 remaining = total - offset;
        returned = remaining < limit ? remaining : limit;
        schemas = new VCSchema[](returned);
        for (uint256 i = 0; i < returned; i++) {
            string memory schemaId = vcSchemas[offset + i];
            uint latestVersion = schemaLatestVersion[schemaId];
            schemas[i] = schemaMap[schemaId][latestVersion];
        }
        return (schemas, total, returned);
    }

    function getSchema(string memory schemaId, uint version) public view returns (VCSchema memory) {
        require(bytes(schemaMap[schemaId][version].id).length != 0, "Schema not found");
        return schemaMap[schemaId][version];
    }

    function getLatestSchema(string memory schemaId) public view returns (VCSchema memory) {
        uint latestVersion = schemaLatestVersion[schemaId];
        require(latestVersion > 0, "Schema does not exist");
        return schemaMap[schemaId][latestVersion];
    }

    function getAllVCs() public view returns (VCStatus[] memory) {
        VCStatus[] memory vcs = new VCStatus[](vcIds.length);
        for (uint i = 0; i < vcIds.length; i++) {
            vcs[i] = vcMap[vcIds[i]];
        }
        return vcs;
    }

    function getVCStatus(string memory _vcId) public view returns (VCStatus memory) {
        require(bytes(vcMap[_vcId].id).length != 0, "VC not found");
        return vcMap[_vcId];
    }
}
