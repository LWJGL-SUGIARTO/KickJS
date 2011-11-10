/*!
 * New BSD License
 *
 * Copyright (c) 2011, Morten Nobel-Joergensen, Kickstart Games ( http://www.kickstartgames.com/ )
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
 * following conditions are met:
 *
 * - Redistributions of source code must retain the above copyright notice, this list of conditions and the following
 * disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
 * disclaimer in the documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
 * INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
KICK.namespace = KICK.namespace || function (ns_string) {
    var parts = ns_string.split("."),
        parent = KICK,
        i;
    // strip redundant leading global
    if (parts[0] === "KICK") {
        parts = parts.slice(1);
    }

    for (i = 0; i < parts.length; i += 1) {
        // create property if it doesn't exist
        if (typeof parent[parts[i]] === "undefined") {
            parent[parts[i]] = {};
        }
        parent = parent[parts[i]];
    }
    return parent;
};

(function () {
    "use strict"; // force strict ECMAScript 5

    var importer = KICK.namespace("KICK.importer"),
        math = KICK.namespace("KICK.math"),
        quat4 = math.quat4;

     /**
     * Imports a collada meshes into a scene
     * @class ColladaImporter
     * @namespace KICK.importer
     */
    importer.ColladaImporter = {};

    /**
     * @method loadCollada
     * @param {XMLDom} colladaDOM
     * @param {KICK.core.Engine} engine
     * @param {KICK.scene.Scene} scene Optional. If not specified the active scene (from the engine) is used
     * @param {boolean} rotate90x rotate -90 degrees around x axis
     * @return {Array[KICK.scene.GameObject]}
     * @static
     */
    importer.ColladaImporter.loadCollada = function (colladaDOM, engine, scene, rotate90x){
        var dataCache = {},
            constants = KICK.core.Constants,
            /**
             * Converts a string to an array
             * @method stringToArray
             * @param {String} numberString
             * @param {Number} count Optional
             * @param {Object} type Optional - valid types are Array (default), and typed arrays classes
             * @private
             */
            stringToArray = function(numberString,count,type){
                if (!type){
                    type = Array;
                }
                if (!count){
                    count = 0;
                }
                numberString = numberString.replace(/^\s+|\s+$/g,""); // trim
                var res = new type(count);
                var counter = 0;
                var lastIndex = 0;
                var currentPosition = 0;
                while ((currentPosition = numberString.indexOf(' ',lastIndex)) !== -1){
                    var num = numberString.substring(lastIndex,currentPosition);
                    res[counter++] = Number(num);
                    lastIndex = currentPosition+1;
                }
                num = numberString.substring(lastIndex);
                res[counter] = Number(num);
                return res;
            },
            /**
             * Get data element by id<br>
             * Note that the array is cached by id - this is done
             * to speed up performance in case of interleaved data
             * @method getArrayElementById
             * @param {String} id
             * @return {Array[Number]} data
             * @private
             */
            getArrayElementById = function(id){
                if (id.charAt(0) === '#'){
                    id = id.substring(1);
                }
                if (dataCache[id]){
                    return dataCache[id];
                }
                var arrayElement = colladaDOM.getElementById(id);
                var type;
                if (arrayElement.tagName === "float_array"){
                    type = Float32Array;
                } else {
                    type = Int32Array;
                }
                var count = Number(arrayElement.getAttribute("count"));
                var res = stringToArray(arrayElement.textContent,count,type);
                dataCache[id] = res;
                return res;
            },
            /**
             * Create accessor object for data
             * @method buildDataAccessor
             * @param {XML} elementChild
             * @return function of type function(index,paramOffset)
             * @private
             */
            buildDataAccessor = function(elementChild){
                var semantic = elementChild.getAttribute('semantic');
                var source = colladaDOM.getElementById(elementChild.getAttribute("source").substring(1));
                if (source.tagName === "vertices"){
                    source = source.getElementsByTagName("input")[0];
                    source = colladaDOM.getElementById(source.getAttribute("source").substring(1));
                }
                var technique_common = source.getElementsByTagName("technique_common")[0];
                var accessor = technique_common.getElementsByTagName("accessor")[0];
                var count = Number(accessor.getAttribute("count"));
                var stride = Number(accessor.getAttribute("stride"));
                var offset = Number(accessor.getAttribute("offset"));
                if (!offset){
                    offset = 0;
                }
                var arraySource = accessor.getAttribute("source");
                var rawData = getArrayElementById(arraySource);

                /**
                 * @param {Number} index (vertex index)
                 * @param {Number} paramOffset (0 means x, 1 means y, etc)
                 * @return {Number}
                 */
                return function(index,paramOffset){
                    var arrayIndex = offset+stride*index+paramOffset;
                    return rawData[arrayIndex];
                };
            },
            /**
             * @method buildFromPolyList
             * @private
             * @param {XMLDomElement} polylist
             * @param {KICK.mesh.MeshData} destMeshData
             */
            buildFromPolyList = function(polylist, destMeshData){
                var polylistChild = polylist.firstChild,
                    tagName,
                    i,j,
                    vertexCount,
                    count = Number(polylist.getAttribute("count")),
                    dataAccessor = {names:[],offset:{},accessors:{},length:{}},
                    offsetSet = [],
                    contains = KICK.core.Util.contains;

                while (polylistChild !== null){
                    tagName = polylistChild.tagName;
                    if (tagName === "input"){
                        var semantic = polylistChild.getAttribute('semantic');
                        var offset = Number(polylistChild.getAttribute('offset'));
                        dataAccessor.accessors[semantic] = buildDataAccessor(polylistChild);
                        dataAccessor.names.push(semantic);
                        dataAccessor.offset[semantic] = offset;
                        dataAccessor.length[semantic] = semantic === "TEXCOORD"?2:3;
                        if (!contains(offsetSet,offset)){
                            offsetSet.push(offset);
                        }
                    } else if (tagName === "vcount"){
                        vertexCount = stringToArray(polylistChild.textContent,count,Int32Array);
                    } else if (tagName === "p"){
                        var numberOfVertexIndices = 0,
                            vertexCountLength = vertexCount.length,
                            offsetCount = offsetSet.length;
                        for (i=vertexCountLength-1;i>=0;i--){
                            numberOfVertexIndices += vertexCount[i];
                        }

                        var numberOfVertexIndicesWithOffset = numberOfVertexIndices*offsetCount;
                        var vertexIndices = stringToArray(polylistChild.textContent,numberOfVertexIndicesWithOffset,Int32Array);

                        // initialize data container
                        var result = {};
                        for (i=0;i<dataAccessor.names.length;i++){
                            result[dataAccessor.names[i]] = [];
                        }

                        var addVertexAttributes = function(index,triangleIndices){
                            index *= offsetCount;
                            for (var i=0;i<dataAccessor.names.length;i++){
                                var name = dataAccessor.names[i];
                                var accessor = dataAccessor.accessors[name];
                                var length = dataAccessor.length[name];
                                var offset = dataAccessor.offset[name];
                                var vertexIndex = vertexIndices[offset+index];
                                for (var j=0;j<length;j++){
                                    var value = accessor(vertexIndex,j);
                                    result[name].push(value);
                                }
                            }
                            triangleIndices.push(triangleIndices.length);
                        };

                        // triangulate data
                        var index = 0;
                        var triangleIndices = [];
                        for (i=0;i<vertexCount.length;i++){
                            for (j=0;j<3;j++){
                                addVertexAttributes(index+j,triangleIndices);
                            }
                            for (j=3;j<vertexCount[i];j++){
                                addVertexAttributes(index+0,triangleIndices);
                                addVertexAttributes(index+j-1,triangleIndices);
                                addVertexAttributes(index+j,triangleIndices);
                            }
                            index += vertexCount[i];
                        }

                        for (i=0;i<dataAccessor.names.length;i++){
                            var name = dataAccessor.names[i];
                            var nameMeshData = name.toLowerCase();
                            if (nameMeshData === "texcoord"){
                                nameMeshData = "uv1";
                            }
                            destMeshData[nameMeshData] = result[name];
                        }

                        destMeshData.meshType = constants.GL_TRIANGLES;
                        destMeshData.indices = triangleIndices;
                    }
                    polylistChild = polylistChild .nextSibling;
                }
            },
            /**
             * @method buildFromTriangles
             * @private
             */
            buildFromTriangles = function(meshChild, destMeshData){
                // todo: implement
                KICK.core.Util.fail("buildFromTriangles not implemented");
            },
            /**
             * @method buildFromTrianglestrips
             * @private buildFromTrianglestrips
             */
            buildFromTrianglestrips = function(meshChild, destMeshData){
                // todo: implement
                KICK.core.Util.fail("buildFromTrianglestrips not implemented");
            },
            buildMeshData = function (colladaDOM, engine, geometry){
                var i,
                    tagName,
                    meshChild,
                    name = geometry.getAttribute('name'),
                    destMeshData = new KICK.mesh.MeshData({name:name}),
                    mesh = geometry.getElementsByTagName("mesh");
                if (mesh.length==0){
                    return null;
                }
                mesh = mesh[0];
                meshChild = mesh.firstChild;
                while (meshChild !== null){
                    tagName = meshChild.tagName;
                    if (tagName === "lines"){
                        console.log("lines");
                    } else if (tagName === "linestrips"){
                        console.log("linestrips");
                    } else if (tagName === "polygons"){
                        console.log("polygons");
                    } else if (tagName === "polylist"){
                        buildFromPolyList(meshChild,destMeshData);
                    } else if (tagName === "triangles"){
                        buildFromTriangles(meshChild);
                    } else if (tagName === "trifans"){
                        console.log("trifans unsupported");
                    } else if (tagName === "tristrips"){
                        buildFromTrianglestrips(meshChild);
                    }
                    meshChild = meshChild.nextSibling;
                }
                return destMeshData;
            };


        var libraryGeometries = colladaDOM.firstChild.getElementsByTagName("library_geometries"),
            visualScenes = colladaDOM.firstChild.getElementsByTagName("visual_scene"),
            geometries,
            i;

        if (!scene){
            scene = engine.activeScene;
        }
        if (libraryGeometries.length==0){
            // no geometries found
        }

        libraryGeometries = libraryGeometries[0];
        geometries = libraryGeometries.getElementsByTagName("geometry");
        var gameObjectsCreated = [];
        var meshCache = {};
        var getMeshById = function(engine, meshid){
            var mesh,
                k,
                geometry;
            if (meshCache[meshid]){
                return meshCache[meshid];
            }
            if (meshid && meshid.charAt(0)==="#"){
                meshid = meshid.substring(1);
            }
            for (k=0;k<geometries.length;k++){
                geometry = geometries[k];
                if (geometry.getAttribute("id") === meshid){
                    var meshData = buildMeshData(colladaDOM, engine, geometry);
                    mesh = new KICK.mesh.Mesh(engine, {},meshData);
                    break;
                }
            }
            meshCache[meshid] = mesh;
            return mesh;
        };

        var updateTransform = function(transform, node){
            var tagName = node.tagName,
                sid = node.getAttribute('sid');
            if (tagName === "translate"){
                transform.localPosition = stringToArray(node.textContent);
            } else if (tagName === "rotate"){
                var angleAxis = stringToArray(node.textContent);
                var angle = angleAxis[3];
                if (angle){
                    var rotationQuat = quat4.angleAxis(angle,angleAxis);
                    var currentQuat = transform.localRotation;
                    transform.localRotation = quat4.multiply(currentQuat,rotationQuat,rotationQuat);
                }
            } else if (tagName === "scale"){
                transform.localScale = stringToArray(node.textContent);
            }
        };

        var createMeshRenderer = function(gameObject, node){
            var url = node.getAttribute("url"),
                meshRenderer = new KICK.scene.MeshRenderer();
            if (url){
                url = url.substring(1);
            }
            var shader = new KICK.material.Shader(engine);

            shader.updateShader();
            var url = node.getAttribute("url");

            meshRenderer.mesh = getMeshById(engine,url);
            console.log("Mesh",meshRenderer.mesh);
            meshRenderer.material = new KICK.material.Material({
                name:"Some material",
                shader:shader
            });
            console.log("Getting mesh by id "+url);
            console.log("meshRenderer.material name "+meshRenderer.material.name);
            console.log("meshRenderer.material shader "+meshRenderer.material.shader);

            gameObject.addComponent(meshRenderer);

        };

        var addNode = function(node, parent){
            var gameObject = scene.createGameObject();
            var transform = gameObject.transform;
            if (parent){
                transform.parent = parent;
            }
            gameObject.name = node.getAttribute("id");
            gameObjectsCreated.push(gameObject);
            var childNode = node.firstElementChild;
            while (childNode){
                var tagName = childNode.tagName;
                if (tagName === "translate" ||
                    tagName === "rotate" ||
                    tagName === "scale"){
                    updateTransform(transform, childNode);
                }
                else if (tagName === "instance_geometry"){
                    createMeshRenderer(gameObject, childNode);
                    /*if (rotate90x){
                        var currentRotation = transform.localRotation;
                        var rotationAroundX = quat4.angleAxis(-90,[1,0,0]);
                        transform.localRotation = quat4.multiply(rotationAroundX,currentRotation);
                    }*/
                } else if (tagName === "node"){
                    addNode(childNode,transform);
                }
                childNode = childNode.nextElementSibling;
            }
        };

        for (var i=0;i<visualScenes.length;i++){
            var visualScene = visualScenes[i];
            var node = visualScene.firstElementChild;
            while (node){
                addNode(node, null);
                node = node.nextElementSibling;
            }
        }
        return gameObjectsCreated;

    }
})();